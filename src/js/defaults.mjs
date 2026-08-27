/**
 * Default values for node and connection properties.
 */

export const NODE_DEFAULTS = {
    type: 'basic',
    shape: 'rectangle',
    width: 100,
    height: 40,
    fontSize: 12,
    fontSizeMin: 1,
    fontSizeMax: 72,
    fontColor: '#333333',
    faceColor: '#ffffff',
    edgeColor: '#bbbbbb',
    edgeWidth: 1,
    toPosition: 'bottom',
    fromPosition: 'top',
    popupDirection: 'right',
    //連接點(把手)樣式: 連出點(source)深底白框, 連入點(target)白底深框(1.0.36 起互換, 使可拖曳建線之出發點更醒目)
    //Size 為外徑(含框線, box-sizing:border-box); 舊版 8px 內寬 + 1px 框線 = 外徑 10px, 故預設 10 維持既有視覺尺寸
    handleSourceFaceColor: '#555555',
    handleSourceEdgeColor: '#ffffff',
    handleSourceEdgeWidth: 1,
    handleSourceSize: 10,
    handleTargetFaceColor: '#ffffff',
    handleTargetEdgeColor: '#1a1918',
    handleTargetEdgeWidth: 1,
    handleTargetSize: 10,
}

export const CONN_DEFAULTS = {
    type: 'bezier',
    fontSize: 10,
    fontSizeMin: 1,
    fontSizeMax: 72,
    fontColor: '#333333',
    edgeColor: '#b1b1b7',
    edgeWidth: 1,
    markerEnd: '',
    animated: false,
    defOffset: 24,
}
