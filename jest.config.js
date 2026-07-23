const ts = require('typescript')
const { pathsToModuleNameMapper } = require('ts-jest')

// tsconfig.json uses JSONC (trailing commas), which plain `require(...)`/JSON.parse
// can't handle — read it through the TS compiler API instead, the same parser tsc itself uses.
const tsconfigPath = ts.findConfigFile(__dirname, ts.sys.fileExists, 'tsconfig.json')
const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
if (error) throw new Error(`Failed to read tsconfig.json: ${error.messageText}`)
const { compilerOptions } = config

// Single source of truth for path aliases: derived from tsconfig.json instead of
// hand-duplicated here, so a new @app/* alias only needs to be added once.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src/'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
}
