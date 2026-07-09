module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/test'],
    //測試檔以前綴分類: unit-* / api-* 歸 jest; e2e-* 由 Playwright 直跑(需 dev server), 不歸 jest 管。
    //白名單而非黑名單: 新增之 e2e 檔不會因忘了加 ignore 而被 jest 誤抓。
    testMatch: ['**/unit-*.test.mjs', '**/api-*.test.mjs'],
    testPathIgnorePatterns: ['/node_modules/'],
    moduleFileExtensions: ['mjs', 'js', 'json', 'vue'],
    transform: {
        '^.+\\.vue$': '@vue/vue2-jest',
        '^.+\\.m?js$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(w-component-vue|wsemi|w-jsonview-tree|lodash-es|@popperjs|@mdi)/)',
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: [
        'src/**/*.{mjs,vue}',
    ],
}
