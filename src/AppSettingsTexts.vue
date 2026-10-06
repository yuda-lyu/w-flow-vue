<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">texts</div>
            <a href="//yuda-lyu.github.io/w-flow-vue/examples/ex-AppSettingsTexts.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-flow-vue/blob/master/docs/examples/ex-AppSettingsTexts.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div style="padding-bottom:10px; font-size:0.85rem; color:#666;">Double-click a node or a connection label to open its settings popup.</div>

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative; border:1px solid #ddd;">
                    <WFlowVue
                        :opt="opt"
                    ></WFlowVue>
                </div>

                <div style="padding:0px 20px;">

                    <div :style="`border:1px solid #ddd; width:590px; min-width:590px; height:${opt.height}px; overflow-y:auto;`">
                        <div style="padding-left:5px;">
                            <div id="optjson" style="font-size:10pt;"></div>
                        </div>
                    </div>

                </div>

            </div>

        </div>

    </div>
</template>

<script>
import WFlowVue from './components/WFlowVue.vue'
import jv from 'w-jsonview-tree'

export default {
    components: {
        WFlowVue,
    },
    data: function() {
        return {
            'opt': {
                width: 800,
                height: 500,
                nodes: [
                    { id: '1', name: '資料來源', description: '從外部 API 取得原始資料', position: { x: 300, y: 0 }, width: 100, height: 40 },
                    { id: '2', name: '條件判斷', description: '根據條件分流處理', position: { x: 290, y: 120 }, shape: 'diamond', width: 120, height: 80 },
                    { id: '3', name: '商業邏輯', description: '執行核心商業規則', position: { x: 80, y: 280 }, shape: 'ellipse', width: 140, height: 60 },
                    { id: '4', name: '過濾器', description: '過濾不符合條件的資料', position: { x: 520, y: 270 }, shape: 'triangle-down', width: 100, height: 80 },
                    { id: '5', name: '輸出結果', description: '將最終結果寫入資料庫', position: { x: 300, y: 420 }, width: 100, height: 40 },
                ],
                conns: [
                    { id: 'e1-2', from: '1', to: '2', type: 'bezier', name: '原始資料', description: '未經處理的 API 回應', markerTo: 'arrowclosed' },
                    { id: 'e2-3', from: '2', to: '3', type: 'smoothstep', name: '條件成立', description: '進入商業邏輯', markerTo: 'arrow' },
                    { id: 'e2-4', from: '2', to: '4', type: 'step', name: '條件不成立', description: '送往過濾', markerFrom: 'arrow', markerTo: 'arrowclosed' },
                    { id: 'e3-5', from: '3', to: '5', type: 'bezier', animated: true, name: '計算結果', description: '商業邏輯輸出' },
                    { id: 'e4-5', from: '4', to: '5', type: 'straight', name: '已過濾', description: '通過過濾的資料' },
                ],
                //節點設定彈窗之顯示文字: 每句一個 opt 鍵, 皆可省略(省略者維持英文預設)
                nodesSettingsBasicGroupTitle: '節點資訊',
                nodesSettingsAppearanceGroupTitle: '外觀',
                nodesSettingsTextGroupTitle: '文字',
                nodesSettingsAdvancedGroupTitle: '進階',
                nodesSettingsTextLabelName: '名稱',
                nodesSettingsTextLabelDescription: '說明',
                nodesSettingsTextLabelShape: '形狀',
                nodesSettingsTextLabelFaceColor: '填色',
                nodesSettingsTextLabelEdgeColor: '框線色',
                nodesSettingsTextLabelEdgeWidth: '框線寬',
                nodesSettingsTextLabelFontSize: '字級',
                nodesSettingsTextLabelFontColor: '文字色',
                nodesSettingsTextLabelPopupDirection: '彈窗方向',
                nodesSettingsShapeTextForRectangle: '矩形',
                nodesSettingsShapeTextForDiamond: '菱形',
                nodesSettingsShapeTextForEllipse: '橢圓',
                nodesSettingsShapeTextForTriangleUp: '上三角形',
                nodesSettingsShapeTextForTriangleRight: '右三角形',
                nodesSettingsShapeTextForTriangleDown: '下三角形',
                nodesSettingsShapeTextForTriangleLeft: '左三角形',
                nodesSettingsPopupDirectionTextForTop: '上',
                nodesSettingsPopupDirectionTextForRight: '右',
                nodesSettingsPopupDirectionTextForBottom: '下',
                nodesSettingsPopupDirectionTextForLeft: '左',
                nodesSettingsDeleteText: '刪除節點',
                nodesSettingsColorConfirmText: '確定',
                //連線設定彈窗之顯示文字: 與節點各自一組鍵, 同一群(如 basic)可給不同文字
                connsSettingsBasicGroupTitle: '連線資訊',
                connsSettingsPathGroupTitle: '路徑',
                connsSettingsAppearanceGroupTitle: '外觀',
                connsSettingsArrowsGroupTitle: '箭頭',
                connsSettingsTextGroupTitle: '文字',
                connsSettingsAdvancedGroupTitle: '進階',
                connsSettingsTextLabelName: '名稱',
                connsSettingsTextLabelDescription: '說明',
                connsSettingsTextLabelType: '線型',
                connsSettingsTextLabelFromPosition: '起點錨',
                connsSettingsTextLabelToPosition: '終點錨',
                connsSettingsTextLabelPoints: '轉折點',
                connsSettingsTextLabelEdgeColor: '線色',
                connsSettingsTextLabelEdgeWidth: '線寬',
                connsSettingsTextLabelAnimated: '動畫',
                connsSettingsTextLabelMarkerFrom: '起點箭頭',
                connsSettingsTextLabelMarkerFromSize: '起點箭頭大小',
                connsSettingsTextLabelMarkerFromFaceColor: '起點箭頭填色',
                connsSettingsTextLabelMarkerFromEdgeColor: '起點箭頭框色',
                connsSettingsTextLabelMarkerTo: '終點箭頭',
                connsSettingsTextLabelMarkerToSize: '終點箭頭大小',
                connsSettingsTextLabelMarkerToFaceColor: '終點箭頭填色',
                connsSettingsTextLabelMarkerToEdgeColor: '終點箭頭框色',
                connsSettingsTextLabelFontSize: '字級',
                connsSettingsTextLabelFontColor: '文字色',
                connsSettingsTextLabelPopupDirection: '彈窗方向',
                connsSettingsTypeTextForBezier: '貝茲曲線',
                connsSettingsTypeTextForStraight: '直線',
                connsSettingsTypeTextForStep: '階梯',
                connsSettingsTypeTextForSmoothstep: '圓角階梯',
                connsSettingsPositionTextForTop: '上',
                connsSettingsPositionTextForRight: '右',
                connsSettingsPositionTextForBottom: '下',
                connsSettingsPositionTextForLeft: '左',
                connsSettingsMarkerTextForNone: '無',
                connsSettingsMarkerTextForArrow: '線式箭頭',
                connsSettingsMarkerTextForArrowclosed: '實心箭頭',
                connsSettingsPopupDirectionTextForTop: '上',
                connsSettingsPopupDirectionTextForRight: '右',
                connsSettingsPopupDirectionTextForBottom: '下',
                connsSettingsPopupDirectionTextForLeft: '左',
                connsSettingsPointsAddBtnTooltip: '新增轉折點',
                connsSettingsPointsRemoveBtnTooltip: '移除此轉折點',
                connsSettingsPointsTextEmpty: '無(自動路由)',
                connsSettingsPointsXTooltip: 'X 座標',
                connsSettingsPointsYTooltip: 'Y 座標',
                connsSettingsDeleteText: '刪除連線',
                connsSettingsColorConfirmText: '確定',
            },
            'action': [
            ],
        }
    },
    mounted: function() {
        let vo = this
        vo.showOptJson()
    },
    watch: {
        opt: {
            handler: function() {
                let vo = this
                vo.showOptJson()
            },
            deep: true,
        },
    },
    methods: {
        showOptJson: function() {
            let vo = this
            jv(vo.opt, document.querySelector('#optjson'), { expanded: true })
        },
    },
}
</script>

<style>
</style>
