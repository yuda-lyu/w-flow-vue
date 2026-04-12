<template>
    <div>

        <div class="bkh">
            <div style="font-size:1.5rem;">connectivity</div>
            <a href="//yuda-lyu.github.io/w-flow-vue/examples/ex-AppExamConnectivity.html" target="_blank" class="item-link">example</a>
            <a href="//github.com/yuda-lyu/w-flow-vue/blob/master/docs/examples/ex-AppExamConnectivity.html" target="_blank" class="item-link">code</a>
        </div>

        <div class="bkp">

            <div v-if="!loading">
                <div style="display:flex; gap:16px; margin-bottom:10px; align-items:center; flex-wrap:wrap;">
                    <label>A 連出點
                        <select v-model="srcHandle" @change="rebuild">
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                    <label>B 方位
                        <select v-model="tgtQuadrant" @change="resetPositions(); rebuild()">
                            <option value="N">上 (N)</option>
                            <option value="NE">右上 (NE)</option>
                            <option value="E">右 (E)</option>
                            <option value="SE">右下 (SE)</option>
                            <option value="S">下 (S)</option>
                            <option value="SW">左下 (SW)</option>
                            <option value="W">左 (W)</option>
                            <option value="NW">左上 (NW)</option>
                        </select>
                    </label>
                    <label>B 連入點
                        <select v-model="tgtHandle" @change="rebuild">
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </label>
                </div>
            </div>

            <div style="display:flex; padding-bottom:40px; overflow-x:auto;">

                <div style="position:relative; border:1px solid #ddd;">
                    <WFlowVue
                        :opt="opt"
                        @init="loading=false"
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
            'loading': true,
            'srcHandle': 'bottom',
            'tgtQuadrant': 'SE',
            'tgtHandle': 'top',
            'CENTER_X': 350,
            'CENTER_Y': 250,
            'OFFSET': 200,
            'NODE_W': 100,
            'NODE_H': 40,
            'opt': {
                width: 800,
                height: 600,
                nodes: [],
                conns: [],
            },
            'action': [
            ],
        }
    },
    mounted: function() {
        let vo = this
        vo.rebuild()
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
    computed: {
        quadrantOffsets: function() {
            let vo = this
            // Offsets are from A's top-left corner.
            // N/S: align B center-x with A center-x → dx = 0
            // E/W: align B center-y with A center-y → dy = 0
            let OFFSET = vo.OFFSET
            let r = {
                N: { x: 0, y: -OFFSET },
                NE: { x: OFFSET, y: -OFFSET },
                E: { x: OFFSET, y: 0 },
                SE: { x: OFFSET, y: OFFSET },
                S: { x: 0, y: OFFSET },
                SW: { x: -OFFSET, y: OFFSET },
                W: { x: -OFFSET, y: 0 },
                NW: { x: -OFFSET, y: -OFFSET },
            }
            return r
        },
        caseLabel: function() {
            return 'A.' + this.srcHandle + ' -> ' + this.tgtQuadrant + ' -> B.' + this.tgtHandle
        },
    },
    methods: {
        rebuild: function() {
            let vo = this
            if (vo.opt.nodes.length === 0) {
                // Initial build — B position offset from A's top-left
                let qOff = vo.quadrantOffsets[vo.tgtQuadrant]
                let bx = vo.CENTER_X + qOff.x
                let by = vo.CENTER_Y + qOff.y
                if (bx < 10) bx = 10
                if (by < 10) by = 10
                vo.opt.nodes = [
                    { id: 'A', type: 'basic', name: 'A', position: { x: vo.CENTER_X, y: vo.CENTER_Y }, width: vo.NODE_W, height: vo.NODE_H, toPosition: vo.srcHandle },
                    { id: 'B', type: 'basic', name: 'B', position: { x: bx, y: by }, width: vo.NODE_W, height: vo.NODE_H, fromPosition: vo.tgtHandle },
                ]
                vo.opt.conns = [
                    { id: 'eA-B', from: 'A', to: 'B', type: 'step', name: vo.caseLabel },
                ]
            }
            else {
                // Update handle positions and conn name, preserve node positions
                vo.opt.nodes[0].toPosition = vo.srcHandle
                vo.opt.nodes[1].fromPosition = vo.tgtHandle
                vo.opt.conns[0].name = vo.caseLabel
            }
        },
        resetPositions: function() {
            let vo = this
            let qOff = vo.quadrantOffsets[vo.tgtQuadrant]
            let bx = vo.CENTER_X + qOff.x
            let by = vo.CENTER_Y + qOff.y
            if (bx < 10) bx = 10
            if (by < 10) by = 10
            vo.opt.nodes[0].position = { x: vo.CENTER_X, y: vo.CENTER_Y }
            vo.opt.nodes[1].position = { x: bx, y: by }
        },
        showOptJson: function() {
            let vo = this
            jv(vo.opt, document.querySelector('#optjson'), { expanded: true })
            // let pathD = ''
            // let edgeEl = document.querySelector('[data-id="eA-B"] path')
            // if (edgeEl) pathD = edgeEl.getAttribute('d')
            // let BUILD_HASH = 'f2h7k4'
            // console.log(BUILD_HASH + ': ' + JSON.stringify({ opt: vo.opt, path: pathD }))
        },
    },
}
</script>

<style>
</style>
