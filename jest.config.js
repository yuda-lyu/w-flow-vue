module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    testPathIgnorePatterns: ['/node_modules/', 'visual-regression\\.test\\.mjs', 'generate-visual-baselines\\.mjs'],
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
