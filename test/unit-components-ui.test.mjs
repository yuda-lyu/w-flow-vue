import { mount } from '@vue/test-utils'
import Controls from '../src/components/ui/Controls.vue'
import WGroupIconCheck from 'w-component-vue/src/components/WGroupIconCheck.vue'

//Controls以WGroupIconCheck渲染, 單顆按鈕為[role="button"]之元素(非原生<button>)
const btns = (w) => w.findAll('[role="button"]')

//WGroupIconCheck之toggleState於$nextTick內才emit, 故點擊後需多刷幾輪microtask才看得到結果
const flush = async (w) => {
    for (let i = 0; i < 3; i++) {
        await w.vm.$nextTick()
    }
}
//WButtonCircle之role="button"在最外層div, 但@click掛在內層之可點擊面(帶cursor:pointer)上,
//jsdom之trigger不會往下傳, 故點擊須打在該內層元素
const clickItem = async (w, i) => {
    await btns(w).at(i).find('[style*="cursor: pointer"]').trigger('click')
    await flush(w)
}

describe('Controls 預設(不給任何menu選項)', () => {
    test('顯示5顆鈕: setting/zoomIn/zoomOut/fitView/lock', () => {
        const w = mount(Controls)
        expect(w.vm.allItems.map((v) => v.id)).toEqual(['setting', 'zoomIn', 'zoomOut', 'fitView', 'interactive'])
        expect(btns(w)).toHaveLength(5)
        w.destroy()
    })

    test('tooltip與icon為現行英文預設', () => {
        const w = mount(Controls)
        expect(w.vm.allItems.map((v) => v.tooltip)).toEqual(['Settings', 'Zoom In', 'Zoom Out', 'Fit View', 'Lock'])
        w.destroy()
    })

    test('套用top-left位置class', () => {
        const w = mount(Controls)
        expect(w.classes()).toContain('vue-flow__panel--top-left')
        w.destroy()
    })
})

describe('Controls 事件', () => {
    test('各鈕點擊送出對應事件', async () => {
        const w = mount(Controls)
        await clickItem(w, 1)
        expect(w.emitted('zoom-in')).toBeTruthy()
        await clickItem(w, 2)
        expect(w.emitted('zoom-out')).toBeTruthy()
        await clickItem(w, 3)
        expect(w.emitted('fit-view')).toBeTruthy()
        await clickItem(w, 4)
        expect(w.emitted('toggle-interactive')).toBeTruthy()
        w.destroy()
    })

    test('設定鈕點擊為收合/展開, 不送出事件', async () => {
        const w = mount(Controls)
        expect(w.vm.useItems).toHaveLength(5)
        await clickItem(w, 0)
        expect(w.vm.useItems).toHaveLength(1)
        expect(w.vm.useItems[0].id).toBe('setting')
        await clickItem(w, 0)
        expect(w.vm.useItems).toHaveLength(5)
        expect(w.emitted('zoom-in')).toBeFalsy()
        expect(w.emitted('toggle-interactive')).toBeFalsy()
        w.destroy()
    })
})

describe('Controls 可見性(useMenu/useMenuItem*)', () => {
    test('useMenu=false整列不渲染', () => {
        const w = mount(Controls, { propsData: { menu: { useMenu: false } } })
        expect(w.find('.vue-flow__panel').exists()).toBe(false)
        w.destroy()
    })

    test('useMenuItemZoomIn=false僅隱藏放大鈕, 縮小鈕仍在', () => {
        const w = mount(Controls, { propsData: { menu: { useMenuItemZoomIn: false } } })
        expect(w.vm.allItems.map((v) => v.id)).toEqual(['setting', 'zoomOut', 'fitView', 'interactive'])
        w.destroy()
    })

    test('useMenuItemZoomOut=false僅隱藏縮小鈕, 放大鈕仍在', () => {
        const w = mount(Controls, { propsData: { menu: { useMenuItemZoomOut: false } } })
        expect(w.vm.allItems.map((v) => v.id)).toEqual(['setting', 'zoomIn', 'fitView', 'interactive'])
        w.destroy()
    })

    test('useMenuItemFitView=false隱藏全圖鈕', () => {
        const w = mount(Controls, { propsData: { menu: { useMenuItemFitView: false } } })
        expect(w.vm.allItems.map((v) => v.id)).toEqual(['setting', 'zoomIn', 'zoomOut', 'interactive'])
        w.destroy()
    })

    test('useMenuItemLock=false隱藏鎖頭鈕', () => {
        const w = mount(Controls, { propsData: { menu: { useMenuItemLock: false } } })
        expect(w.vm.allItems.map((v) => v.id)).toEqual(['setting', 'zoomIn', 'zoomOut', 'fitView'])
        w.destroy()
    })

    test('useSetting=false初始即收合', () => {
        const w = mount(Controls, { propsData: { menu: { useSetting: false } } })
        expect(w.vm.useItems).toHaveLength(1)
        expect(w.vm.useItems[0].id).toBe('setting')
        w.destroy()
    })
})

describe('Controls 文字與icon覆寫', () => {
    test('逐項覆寫tooltip', () => {
        const w = mount(Controls, {
            propsData: {
                menu: {
                    menuSettingTooltip: '收合工具列',
                    menuZoomInTooltip: '放大',
                    menuZoomOutTooltip: '縮小',
                    menuFitViewTooltip: '全圖顯示',
                    menuLockTooltip: '鎖定',
                },
            },
        })
        expect(w.vm.allItems.map((v) => v.tooltip)).toEqual(['收合工具列', '放大', '縮小', '全圖顯示', '鎖定'])
        w.destroy()
    })

    test('部分覆寫時未給者維持英文預設', () => {
        const w = mount(Controls, { propsData: { menu: { menuZoomInTooltip: '放大' } } })
        expect(w.vm.allItems.map((v) => v.tooltip)).toEqual(['Settings', '放大', 'Zoom Out', 'Fit View', 'Lock'])
        w.destroy()
    })

    test('空字串回退預設, 不出現空白tooltip', () => {
        const w = mount(Controls, { propsData: { menu: { menuZoomInTooltip: '' } } })
        expect(w.vm.cfg.menuZoomInTooltip).toBe('Zoom In')
        w.destroy()
    })

    test('型別不符回退預設', () => {
        const w = mount(Controls, {
            propsData: {
                menu: {
                    menuZoomInTooltip: 123,
                    useMenuItemFitView: 'yes',
                    menuIconSize: 'big',
                    menuYShift: NaN,
                },
            },
        })
        expect(w.vm.cfg.menuZoomInTooltip).toBe('Zoom In')
        expect(w.vm.cfg.useMenuItemFitView).toBe(true)
        expect(w.vm.cfg.menuIconSize).toBe(22)
        expect(w.vm.cfg.menuYShift).toBe(0)
        w.destroy()
    })

    test('覆寫icon', () => {
        const w = mount(Controls, { propsData: { menu: { menuZoomInIcon: 'M0 0 L1 1' } } })
        expect(w.vm.allItems[1].icon).toBe('M0 0 L1 1')
        w.destroy()
    })
})

describe('Controls 鎖頭雙態', () => {
    test('未鎖態取無後綴之icon與tooltip', () => {
        const w = mount(Controls, { propsData: { locked: false, menu: { menuLockTooltip: '鎖定', menuLockTooltipLocked: '解除鎖定' } } })
        expect(w.vm.allItems[4].tooltip).toBe('鎖定')
        w.destroy()
    })

    test('已鎖態取Locked後綴之icon與tooltip', () => {
        const w = mount(Controls, { propsData: { locked: true, menu: { menuLockTooltip: '鎖定', menuLockTooltipLocked: '解除鎖定' } } })
        expect(w.vm.allItems[4].tooltip).toBe('解除鎖定')
        w.destroy()
    })

    test('未給覆寫時雙態為Lock/Unlock且icon不同', () => {
        const w0 = mount(Controls, { propsData: { locked: false } })
        const w1 = mount(Controls, { propsData: { locked: true } })
        expect(w0.vm.allItems[4].tooltip).toBe('Lock')
        expect(w1.vm.allItems[4].tooltip).toBe('Unlock')
        expect(w0.vm.allItems[4].icon).not.toBe(w1.vm.allItems[4].icon)
        w0.destroy()
        w1.destroy()
    })
})

describe('Controls 位置與位移', () => {
    test('四個menuPosition各自套用對應class', () => {
        const poss = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
        poss.forEach((p) => {
            const w = mount(Controls, { propsData: { menu: { menuPosition: p } } })
            expect(w.classes()).toContain(`vue-flow__panel--${p}`)
            w.destroy()
        })
    })

    test('menuPosition非允許值回退top-left', () => {
        const w = mount(Controls, { propsData: { menu: { menuPosition: 'middle' } } })
        expect(w.classes()).toContain('vue-flow__panel--top-left')
        w.destroy()
    })

    test('menuYShift於top-*加margin-top, 於bottom-*加margin-bottom', () => {
        const wt = mount(Controls, { propsData: { menu: { menuPosition: 'top-left', menuYShift: 40 } } })
        expect(wt.vm.panelStyle).toContain('margin-top:40px;')
        const wb = mount(Controls, { propsData: { menu: { menuPosition: 'bottom-left', menuYShift: 40 } } })
        expect(wb.vm.panelStyle).toContain('margin-bottom:40px;')
        wt.destroy()
        wb.destroy()
    })
})

describe('Controls 樣式選項', () => {
    test('未給樣式選項時鎖住現行值(不隨w-component-vue預設浮動)', () => {
        const c = mount(Controls).vm.cfg
        expect(c.menuIconColor).toBe('#555')
        expect(c.menuIconColorHover).toBe('#222')
        expect(c.menuIconColorFocus).toBe('#222')
        expect(c.menuIconSize).toBe(22)
        expect(c.menuBackgroundColor).toBe('#fefefe')
        expect(c.menuBackgroundColorHover).toBe('#f0f0f0')
        expect(c.menuBackgroundColorFocus).toBe('#f0f0f0')
        expect(c.menuSeparatorColor).toBe('#e6e6e6')
        expect(c.menuShadow).toBe(true)
        expect(c.menuTooltipTextColor).toBe('white')
        expect(c.menuTooltipTextFontSize).toBe('0.7rem')
        expect(c.menuTooltipBackgroundColor).toBe('rgba(60,60,60,0.75)')
    })

    test('樣式選項可覆寫並下傳至WGroupIconCheck', () => {
        const w = mount(Controls, {
            propsData: {
                menu: {
                    menuIconColor: '#111',
                    menuSeparatorColor: '#abcabc',
                    menuShadow: false,
                    menuTooltipTextFontSize: '1rem',
                },
            },
        })
        const g = w.findComponent(WGroupIconCheck)
        expect(g.props('iconColor')).toBe('#111')
        expect(g.props('seplineColor')).toBe('#abcabc')
        expect(g.props('shadow')).toBe(false)
        expect(g.props('tooltipTextFontSize')).toBe('1rem')
        w.destroy()
    })
})
