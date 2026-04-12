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
