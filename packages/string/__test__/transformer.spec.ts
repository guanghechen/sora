import {
  composeTextTransformers,
  toCamelCase,
  toCapitalCase,
  toConstantCase,
  toDotCase,
  toKebabCase,
  toLowerCase,
  toPascalCase,
  toPathCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
  toTrim,
  toUpperCase,
} from '../src'
import {
  camelCase,
  noCase,
  pascalCase,
  pascalSnakeCase,
  split,
  trainCase,
} from '../src/vender/change-case'
import { titleCase } from '../src/vender/title-case'

describe('string', function () {
  describe('toLowerCase', function () {
    test("'TEST STRING' => 'test string'", () =>
      expect(toLowerCase('TEST STRING')).toEqual('test string'))
  })

  describe('toUpperCase', function () {
    test("'test string' => 'TEST STRING'", () =>
      expect(toUpperCase('test string')).toEqual('TEST STRING'))
  })

  describe('toCapitalCase', function () {
    test("'test string' => 'Test String'", () =>
      expect(toCapitalCase('test string')).toEqual('Test String'))
  })

  describe('toPascalCase', function () {
    test("'test string' => 'TestString'", () =>
      expect(toPascalCase('test string')).toEqual('TestString'))
  })

  describe('toCamelCase', function () {
    test("'test string' => 'testString'", () =>
      expect(toCamelCase('test string')).toEqual('testString'))
  })

  describe('toConstantCase', function () {
    test("'test string' => 'TEST_STRING'", () =>
      expect(toConstantCase('test string')).toEqual('TEST_STRING'))
  })

  describe('toKebabCase', function () {
    test("'test string' => 'test-string'", () =>
      expect(toKebabCase('test string')).toEqual('test-string'))
  })

  describe('toSnakeCase', function () {
    test("'test string' => 'test_string'", () =>
      expect(toSnakeCase('test string')).toEqual('test_string'))
  })

  describe('toPathCase', function () {
    test("'test string' => 'test/string'", () =>
      expect(toPathCase('test string')).toEqual('test/string'))
  })

  describe('toSentenceCase', function () {
    test("'testString' => 'Test string'", () =>
      expect(toSentenceCase('testString')).toEqual('Test string'))
  })

  describe('toTitleCase', function () {
    test("'a simple test' => 'A Simple Test'", () =>
      expect(toTitleCase('a simple test')).toEqual('A Simple Test'))
  })

  describe('toDotCase', function () {
    test("'test string' => 'test.string'", () =>
      expect(toDotCase('test string')).toEqual('test.string'))
  })
})

describe('composeTextTransformers', function () {
  it('trim and lower, then kebab', function () {
    const transform = composeTextTransformers(toTrim, toLowerCase, toKebabCase)
    const text: string = transform(' TeSt_StrinG ')
    expect(text).toEqual('test-string')
  })
})

describe('change-case additional coverage', function () {
  describe('trainCase', function () {
    test("'test string' => 'Test-String'", () =>
      expect(trainCase('test string')).toEqual('Test-String'))
  })

  describe('pascalSnakeCase', function () {
    test("'test string' => 'Test_String'", () =>
      expect(pascalSnakeCase('test string')).toEqual('Test_String'))
  })

  describe('noCase', function () {
    test("'testString' => 'test string'", () => expect(noCase('testString')).toEqual('test string'))
  })

  describe('split with separateNumbers', function () {
    test("'test123abc' => ['test', '123', 'abc']", () =>
      expect(split('test123abc', { separateNumbers: true })).toEqual(['test', '123', 'abc']))
  })

  describe('locale: false', function () {
    test('camelCase with locale: false', () =>
      expect(camelCase('TEST STRING', { locale: false })).toEqual('testString'))

    test('pascalCase with locale: false', () =>
      expect(pascalCase('test string', { locale: false })).toEqual('TestString'))
  })
})

describe('titleCase additional coverage', function () {
  test('preserves manual case like iPhone', () =>
    expect(titleCase('iPhone app')).toEqual('iPhone App'))

  test('keeps small words lowercase in the middle', () =>
    expect(titleCase('the lord of the rings')).toEqual('The Lord of the Rings'))

  test('handles word separators like dash', () =>
    expect(titleCase('well-known fact')).toEqual('Well-Known Fact'))

  test('does not capitalize after non-separator', () =>
    expect(titleCase("don't stop")).toEqual("Don't Stop"))

  test('locale as string', () => expect(titleCase('hello world', 'en')).toEqual('Hello World'))

  test('locale as array', () => expect(titleCase('hello world', ['en'])).toEqual('Hello World'))
})
