import { satisfies } from '../src'

describe('satisfies', () => {
  describe('exact match (= or no operator)', () => {
    it('should match exact versions', () => {
      expect(satisfies('1.0.0', '1.0.0')).toBe(true)
      expect(satisfies('1.0.0', '=1.0.0')).toBe(true)
      expect(satisfies('1.0.1', '1.0.0')).toBe(false)
      expect(satisfies('1.0.0-alpha', '1.0.0-alpha')).toBe(true)
    })

    it('should handle build metadata in version', () => {
      expect(satisfies('1.0.0+build', '1.0.0')).toBe(true)
      expect(satisfies('1.0.0+build123', '=1.0.0')).toBe(true)
    })
  })

  describe('greater than (>)', () => {
    it('should match versions greater than target', () => {
      expect(satisfies('1.0.1', '>1.0.0')).toBe(true)
      expect(satisfies('2.0.0', '>1.0.0')).toBe(true)
      expect(satisfies('1.0.0', '>1.0.0')).toBe(false)
      expect(satisfies('0.9.9', '>1.0.0')).toBe(false)
    })
  })

  describe('greater than or equal (>=)', () => {
    it('should match versions greater than or equal to target', () => {
      expect(satisfies('1.0.1', '>=1.0.0')).toBe(true)
      expect(satisfies('1.0.0', '>=1.0.0')).toBe(true)
      expect(satisfies('0.9.9', '>=1.0.0')).toBe(false)
    })
  })

  describe('less than (<)', () => {
    it('should match versions less than target', () => {
      expect(satisfies('0.9.9', '<1.0.0')).toBe(true)
      expect(satisfies('1.0.0', '<1.0.0')).toBe(false)
      expect(satisfies('1.0.1', '<1.0.0')).toBe(false)
    })
  })

  describe('less than or equal (<=)', () => {
    it('should match versions less than or equal to target', () => {
      expect(satisfies('0.9.9', '<=1.0.0')).toBe(true)
      expect(satisfies('1.0.0', '<=1.0.0')).toBe(true)
      expect(satisfies('1.0.1', '<=1.0.0')).toBe(false)
    })
  })

  describe('caret range (^)', () => {
    it('should allow minor and patch updates when major > 0', () => {
      expect(satisfies('1.0.0', '^1.0.0')).toBe(true)
      expect(satisfies('1.0.1', '^1.0.0')).toBe(true)
      expect(satisfies('1.1.0', '^1.0.0')).toBe(true)
      expect(satisfies('1.9.9', '^1.0.0')).toBe(true)
      expect(satisfies('2.0.0', '^1.0.0')).toBe(false)
      expect(satisfies('0.9.9', '^1.0.0')).toBe(false)
    })

    it('should allow patch updates when major = 0 and minor > 0', () => {
      expect(satisfies('0.1.0', '^0.1.0')).toBe(true)
      expect(satisfies('0.1.1', '^0.1.0')).toBe(true)
      expect(satisfies('0.1.9', '^0.1.0')).toBe(true)
      expect(satisfies('0.2.0', '^0.1.0')).toBe(false)
      expect(satisfies('0.0.9', '^0.1.0')).toBe(false)
    })

    it('should only match exact when major = 0 and minor = 0', () => {
      expect(satisfies('0.0.1', '^0.0.1')).toBe(true)
      expect(satisfies('0.0.2', '^0.0.1')).toBe(false)
      expect(satisfies('0.0.0', '^0.0.1')).toBe(false)
    })

    it('should work with partial versions', () => {
      expect(satisfies('1.5.0', '^1')).toBe(true)
      expect(satisfies('1.0.0', '^1')).toBe(true)
      expect(satisfies('2.0.0', '^1')).toBe(false)
      expect(satisfies('1.2.5', '^1.2')).toBe(true)
      expect(satisfies('1.3.0', '^1.2')).toBe(true)
      expect(satisfies('2.0.0', '^1.2')).toBe(false)
      // ^0.x partial versions
      expect(satisfies('0.1.0', '^0.1')).toBe(true)
      expect(satisfies('0.1.5', '^0.1')).toBe(true)
      expect(satisfies('0.2.0', '^0.1')).toBe(false)
      // ^0.0.x partial
      expect(satisfies('0.0.1', '^0.0')).toBe(true)
      expect(satisfies('0.1.0', '^0.0')).toBe(false)
    })
  })

  describe('tilde range (~)', () => {
    it('should allow patch updates only', () => {
      expect(satisfies('1.0.0', '~1.0.0')).toBe(true)
      expect(satisfies('1.0.1', '~1.0.0')).toBe(true)
      expect(satisfies('1.0.9', '~1.0.0')).toBe(true)
      expect(satisfies('1.1.0', '~1.0.0')).toBe(false)
      expect(satisfies('0.9.9', '~1.0.0')).toBe(false)
    })

    it('should work with minor versions', () => {
      expect(satisfies('1.2.0', '~1.2.0')).toBe(true)
      expect(satisfies('1.2.5', '~1.2.0')).toBe(true)
      expect(satisfies('1.3.0', '~1.2.0')).toBe(false)
    })

    it('should work with partial versions', () => {
      expect(satisfies('1.2.0', '~1.2')).toBe(true)
      expect(satisfies('1.2.5', '~1.2')).toBe(true)
      expect(satisfies('1.3.0', '~1.2')).toBe(false)
    })
  })

  describe('wildcards', () => {
    describe('* wildcard', () => {
      it('should match any version with *', () => {
        expect(satisfies('1.0.0', '*')).toBe(true)
        expect(satisfies('0.0.1', '*')).toBe(true)
        expect(satisfies('999.999.999', '*')).toBe(true)
      })

      it('should not match prerelease with * (node-semver compatible)', () => {
        expect(satisfies('1.0.0-alpha', '*', { includePrerelease: false })).toBe(false)
      })
    })

    describe('x wildcard', () => {
      it('should match any version with x', () => {
        expect(satisfies('1.0.0', 'x')).toBe(true)
        expect(satisfies('2.5.3', 'x')).toBe(true)
      })

      it('should match any version with X', () => {
        expect(satisfies('1.0.0', 'X')).toBe(true)
        expect(satisfies('2.5.3', 'X')).toBe(true)
      })
    })

    describe('1.x range', () => {
      it('should match 1.x.x versions', () => {
        expect(satisfies('1.0.0', '1.x')).toBe(true)
        expect(satisfies('1.5.3', '1.x')).toBe(true)
        expect(satisfies('1.99.99', '1.x')).toBe(true)
        expect(satisfies('2.0.0', '1.x')).toBe(false)
        expect(satisfies('0.9.9', '1.x')).toBe(false)
      })

      it('should work with 1.X', () => {
        expect(satisfies('1.5.0', '1.X')).toBe(true)
        expect(satisfies('2.0.0', '1.X')).toBe(false)
      })

      it('should work with 1.*', () => {
        expect(satisfies('1.5.0', '1.*')).toBe(true)
        expect(satisfies('2.0.0', '1.*')).toBe(false)
      })

      it('should work with 1.x.x', () => {
        expect(satisfies('1.5.0', '1.x.x')).toBe(true)
        expect(satisfies('2.0.0', '1.x.x')).toBe(false)
      })
    })

    describe('1.2.x range', () => {
      it('should match 1.2.x versions', () => {
        expect(satisfies('1.2.0', '1.2.x')).toBe(true)
        expect(satisfies('1.2.5', '1.2.x')).toBe(true)
        expect(satisfies('1.2.99', '1.2.x')).toBe(true)
        expect(satisfies('1.3.0', '1.2.x')).toBe(false)
        expect(satisfies('1.1.9', '1.2.x')).toBe(false)
        expect(satisfies('2.2.0', '1.2.x')).toBe(false)
      })

      it('should work with 1.2.X', () => {
        expect(satisfies('1.2.5', '1.2.X')).toBe(true)
        expect(satisfies('1.3.0', '1.2.X')).toBe(false)
      })

      it('should work with 1.2.*', () => {
        expect(satisfies('1.2.5', '1.2.*')).toBe(true)
        expect(satisfies('1.3.0', '1.2.*')).toBe(false)
      })
    })
  })

  describe('partial versions', () => {
    describe('1 (major only)', () => {
      it('should match >=1.0.0 <2.0.0', () => {
        expect(satisfies('1.0.0', '1')).toBe(true)
        expect(satisfies('1.5.3', '1')).toBe(true)
        expect(satisfies('1.99.99', '1')).toBe(true)
        expect(satisfies('2.0.0', '1')).toBe(false)
        expect(satisfies('0.9.9', '1')).toBe(false)
      })
    })

    describe('1.2 (major.minor)', () => {
      it('should match >=1.2.0 <1.3.0', () => {
        expect(satisfies('1.2.0', '1.2')).toBe(true)
        expect(satisfies('1.2.5', '1.2')).toBe(true)
        expect(satisfies('1.2.99', '1.2')).toBe(true)
        expect(satisfies('1.3.0', '1.2')).toBe(false)
        expect(satisfies('1.1.9', '1.2')).toBe(false)
      })
    })

    describe('0 (major only, edge case)', () => {
      it('should match >=0.0.0 <1.0.0', () => {
        expect(satisfies('0.0.0', '0')).toBe(true)
        expect(satisfies('0.1.0', '0')).toBe(true)
        expect(satisfies('0.99.99', '0')).toBe(true)
        expect(satisfies('1.0.0', '0')).toBe(false)
      })
    })

    describe('0.x (x-range with major 0)', () => {
      it('should match >=0.0.0 <1.0.0', () => {
        expect(satisfies('0.0.0', '0.x')).toBe(true)
        expect(satisfies('0.1.0', '0.x')).toBe(true)
        expect(satisfies('0.5.0', '0.x')).toBe(true)
        expect(satisfies('0.99.99', '0.x')).toBe(true)
        expect(satisfies('1.0.0', '0.x')).toBe(false)
      })
    })

    describe('0.0.x (x-range with major.minor 0.0)', () => {
      it('should match >=0.0.0 <0.1.0', () => {
        expect(satisfies('0.0.0', '0.0.x')).toBe(true)
        expect(satisfies('0.0.5', '0.0.x')).toBe(true)
        expect(satisfies('0.0.99', '0.0.x')).toBe(true)
        expect(satisfies('0.1.0', '0.0.x')).toBe(false)
      })
    })
  })

  describe('hyphen ranges', () => {
    describe('full versions', () => {
      it('should match inclusive range 1.0.0 - 2.0.0', () => {
        expect(satisfies('1.0.0', '1.0.0 - 2.0.0')).toBe(true)
        expect(satisfies('1.5.0', '1.0.0 - 2.0.0')).toBe(true)
        expect(satisfies('2.0.0', '1.0.0 - 2.0.0')).toBe(true)
        expect(satisfies('0.9.9', '1.0.0 - 2.0.0')).toBe(false)
        expect(satisfies('2.0.1', '1.0.0 - 2.0.0')).toBe(false)
      })

      it('should match range 1.2.3 - 2.3.4', () => {
        expect(satisfies('1.2.3', '1.2.3 - 2.3.4')).toBe(true)
        expect(satisfies('2.0.0', '1.2.3 - 2.3.4')).toBe(true)
        expect(satisfies('2.3.4', '1.2.3 - 2.3.4')).toBe(true)
        expect(satisfies('1.2.2', '1.2.3 - 2.3.4')).toBe(false)
        expect(satisfies('2.3.5', '1.2.3 - 2.3.4')).toBe(false)
      })
    })

    describe('partial start version', () => {
      it('should treat 1.2 - 2.3.4 as >=1.2.0 <=2.3.4', () => {
        expect(satisfies('1.2.0', '1.2 - 2.3.4')).toBe(true)
        expect(satisfies('1.2.5', '1.2 - 2.3.4')).toBe(true)
        expect(satisfies('2.3.4', '1.2 - 2.3.4')).toBe(true)
        expect(satisfies('1.1.9', '1.2 - 2.3.4')).toBe(false)
        expect(satisfies('2.3.5', '1.2 - 2.3.4')).toBe(false)
      })

      it('should treat 1 - 2.3.4 as >=1.0.0 <=2.3.4', () => {
        expect(satisfies('1.0.0', '1 - 2.3.4')).toBe(true)
        expect(satisfies('2.3.4', '1 - 2.3.4')).toBe(true)
        expect(satisfies('0.9.9', '1 - 2.3.4')).toBe(false)
      })
    })

    describe('partial end version', () => {
      it('should treat 1.2.3 - 2.3 as >=1.2.3 <2.4.0', () => {
        expect(satisfies('1.2.3', '1.2.3 - 2.3')).toBe(true)
        expect(satisfies('2.3.0', '1.2.3 - 2.3')).toBe(true)
        expect(satisfies('2.3.99', '1.2.3 - 2.3')).toBe(true)
        expect(satisfies('2.4.0', '1.2.3 - 2.3')).toBe(false)
        expect(satisfies('1.2.2', '1.2.3 - 2.3')).toBe(false)
      })

      it('should treat 1.2.3 - 2 as >=1.2.3 <3.0.0', () => {
        expect(satisfies('1.2.3', '1.2.3 - 2')).toBe(true)
        expect(satisfies('2.99.99', '1.2.3 - 2')).toBe(true)
        expect(satisfies('3.0.0', '1.2.3 - 2')).toBe(false)
        expect(satisfies('1.2.2', '1.2.3 - 2')).toBe(false)
      })
    })

    describe('both partial', () => {
      it('should treat 1.0 - 2.0 as >=1.0.0 <2.1.0', () => {
        expect(satisfies('1.0.0', '1.0 - 2.0')).toBe(true)
        expect(satisfies('2.0.0', '1.0 - 2.0')).toBe(true)
        expect(satisfies('2.0.99', '1.0 - 2.0')).toBe(true)
        expect(satisfies('2.1.0', '1.0 - 2.0')).toBe(false)
        expect(satisfies('0.9.9', '1.0 - 2.0')).toBe(false)
      })
    })
  })

  describe('AND operator (space-separated)', () => {
    it('should require all conditions with >=1.0.0 <2.0.0', () => {
      expect(satisfies('1.0.0', '>=1.0.0 <2.0.0')).toBe(true)
      expect(satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true)
      expect(satisfies('1.99.99', '>=1.0.0 <2.0.0')).toBe(true)
      expect(satisfies('2.0.0', '>=1.0.0 <2.0.0')).toBe(false)
      expect(satisfies('0.9.9', '>=1.0.0 <2.0.0')).toBe(false)
    })

    it('should require all conditions with >1.0.0 <=2.0.0', () => {
      expect(satisfies('1.0.1', '>1.0.0 <=2.0.0')).toBe(true)
      expect(satisfies('2.0.0', '>1.0.0 <=2.0.0')).toBe(true)
      expect(satisfies('1.0.0', '>1.0.0 <=2.0.0')).toBe(false)
      expect(satisfies('2.0.1', '>1.0.0 <=2.0.0')).toBe(false)
    })

    it('should handle multiple comparators', () => {
      expect(satisfies('1.5.0', '>=1.0.0 <2.0.0 >1.2.0')).toBe(true)
      expect(satisfies('1.2.0', '>=1.0.0 <2.0.0 >1.2.0')).toBe(false)
      expect(satisfies('1.1.0', '>=1.0.0 <2.0.0 >1.2.0')).toBe(false)
    })
  })

  describe('OR operator (|| separated)', () => {
    it('should match if any condition is met with ^1.0.0 || ^2.0.0', () => {
      expect(satisfies('1.0.0', '^1.0.0 || ^2.0.0')).toBe(true)
      expect(satisfies('1.5.0', '^1.0.0 || ^2.0.0')).toBe(true)
      expect(satisfies('2.0.0', '^1.0.0 || ^2.0.0')).toBe(true)
      expect(satisfies('2.5.0', '^1.0.0 || ^2.0.0')).toBe(true)
      expect(satisfies('3.0.0', '^1.0.0 || ^2.0.0')).toBe(false)
      expect(satisfies('0.9.9', '^1.0.0 || ^2.0.0')).toBe(false)
    })

    it('should handle complex OR with ranges', () => {
      expect(satisfies('1.5.0', '>=1.0.0 <2.0.0 || >=3.0.0 <4.0.0')).toBe(true)
      expect(satisfies('3.5.0', '>=1.0.0 <2.0.0 || >=3.0.0 <4.0.0')).toBe(true)
      expect(satisfies('2.5.0', '>=1.0.0 <2.0.0 || >=3.0.0 <4.0.0')).toBe(false)
      expect(satisfies('4.0.0', '>=1.0.0 <2.0.0 || >=3.0.0 <4.0.0')).toBe(false)
    })

    it('should handle multiple OR branches', () => {
      expect(satisfies('1.0.0', '1.0.0 || 2.0.0 || 3.0.0')).toBe(true)
      expect(satisfies('2.0.0', '1.0.0 || 2.0.0 || 3.0.0')).toBe(true)
      expect(satisfies('3.0.0', '1.0.0 || 2.0.0 || 3.0.0')).toBe(true)
      expect(satisfies('4.0.0', '1.0.0 || 2.0.0 || 3.0.0')).toBe(false)
    })
  })

  describe('operators with partial versions', () => {
    describe('>=', () => {
      it('should treat >=1.2 as >=1.2.0', () => {
        expect(satisfies('1.2.0', '>=1.2')).toBe(true)
        expect(satisfies('1.2.5', '>=1.2')).toBe(true)
        expect(satisfies('1.3.0', '>=1.2')).toBe(true)
        expect(satisfies('1.1.9', '>=1.2')).toBe(false)
      })

      it('should treat >=1 as >=1.0.0', () => {
        expect(satisfies('1.0.0', '>=1')).toBe(true)
        expect(satisfies('2.0.0', '>=1')).toBe(true)
        expect(satisfies('0.9.9', '>=1')).toBe(false)
      })
    })

    describe('<', () => {
      it('should treat <1.2 as <1.2.0-0 (not including any 1.2.x)', () => {
        expect(satisfies('1.1.9', '<1.2')).toBe(true)
        expect(satisfies('1.1.0', '<1.2')).toBe(true)
        expect(satisfies('1.2.0', '<1.2')).toBe(false)
        expect(satisfies('1.2.1', '<1.2')).toBe(false)
      })

      it('should treat <1 as <1.0.0-0', () => {
        expect(satisfies('0.9.9', '<1')).toBe(true)
        expect(satisfies('0.0.1', '<1')).toBe(true)
        expect(satisfies('1.0.0', '<1')).toBe(false)
      })
    })

    describe('>', () => {
      it('should treat >1.2 as >=1.3.0', () => {
        expect(satisfies('1.3.0', '>1.2')).toBe(true)
        expect(satisfies('1.3.1', '>1.2')).toBe(true)
        expect(satisfies('2.0.0', '>1.2')).toBe(true)
        expect(satisfies('1.2.0', '>1.2')).toBe(false)
        expect(satisfies('1.2.99', '>1.2')).toBe(false)
      })

      it('should treat >1 as >=2.0.0', () => {
        expect(satisfies('2.0.0', '>1')).toBe(true)
        expect(satisfies('3.0.0', '>1')).toBe(true)
        expect(satisfies('1.99.99', '>1')).toBe(false)
        expect(satisfies('1.0.0', '>1')).toBe(false)
      })
    })

    describe('<=', () => {
      it('should treat <=1.2 as <1.3.0-0', () => {
        expect(satisfies('1.2.0', '<=1.2')).toBe(true)
        expect(satisfies('1.2.99', '<=1.2')).toBe(true)
        expect(satisfies('1.1.0', '<=1.2')).toBe(true)
        expect(satisfies('1.3.0', '<=1.2')).toBe(false)
      })

      it('should treat <=1 as <2.0.0-0', () => {
        expect(satisfies('1.0.0', '<=1')).toBe(true)
        expect(satisfies('1.99.99', '<=1')).toBe(true)
        expect(satisfies('2.0.0', '<=1')).toBe(false)
      })
    })
  })

  describe('prerelease behavior', () => {
    it('should handle prerelease in exact match', () => {
      expect(satisfies('1.0.0-alpha', '1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(true)
      expect(satisfies('1.0.0-alpha', '1.0.0-beta')).toBe(false)
    })

    it('should only match prerelease when range has same base version prerelease', () => {
      expect(satisfies('1.0.0-alpha', '>1.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '<1.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '>=1.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '<=1.0.0', { includePrerelease: false })).toBe(false)
    })

    it('should match prerelease when range has prerelease with same base', () => {
      expect(satisfies('1.0.0-alpha', '>=1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-beta', '>1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-alpha.7', '>1.0.0-alpha.3')).toBe(true)
      expect(satisfies('1.0.0', '>1.0.0-alpha')).toBe(true)
    })

    it('should not match prerelease of different base version', () => {
      expect(satisfies('1.0.1-alpha', '>1.0.0-alpha', { includePrerelease: false })).toBe(false)
      expect(satisfies('3.4.5-alpha.9', '>1.2.3-alpha.3', { includePrerelease: false })).toBe(false)
    })

    it('should match stable version even when range has prerelease', () => {
      expect(satisfies('1.0.0', '^1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0', '~1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.1', '^1.0.0-alpha')).toBe(true)
    })

    it('should handle prerelease in caret range', () => {
      expect(satisfies('1.0.0-alpha', '^1.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '^1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-beta', '^1.0.0-alpha')).toBe(true)
    })

    it('should handle prerelease in tilde range', () => {
      expect(satisfies('1.0.0-alpha', '~1.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '~1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-beta', '~1.0.0-alpha')).toBe(true)
    })

    it('should handle prerelease in hyphen range', () => {
      expect(satisfies('1.0.0-alpha', '1.0.0 - 2.0.0', { includePrerelease: false })).toBe(false)
      expect(satisfies('1.0.0-alpha', '1.0.0-alpha - 2.0.0')).toBe(true)
    })

    it('should handle prerelease at both ends of hyphen range', () => {
      // Start prerelease allows matching start base version prereleases
      expect(satisfies('1.0.0-alpha', '1.0.0-alpha - 2.0.0-beta')).toBe(true)
      expect(satisfies('1.0.0-gamma', '1.0.0-alpha - 2.0.0-beta')).toBe(true)

      // End prerelease allows matching end base version prereleases
      expect(satisfies('2.0.0-alpha', '1.0.0-alpha - 2.0.0-beta')).toBe(true)
      expect(satisfies('2.0.0-beta', '1.0.0-alpha - 2.0.0-beta')).toBe(true)

      // Stable versions within range should match
      expect(satisfies('1.0.0', '1.0.0-alpha - 2.0.0-beta')).toBe(true)
      expect(satisfies('1.5.0', '1.0.0-alpha - 2.0.0-beta')).toBe(true)

      // Stable 2.0.0 > 2.0.0-beta, so it should NOT match
      expect(satisfies('2.0.0', '1.0.0-alpha - 2.0.0-beta')).toBe(false)

      // Prerelease of different base version should not match
      expect(
        satisfies('1.5.0-alpha', '1.0.0-alpha - 2.0.0-beta', { includePrerelease: false }),
      ).toBe(false)

      // Outside range should not match
      expect(satisfies('0.9.9', '1.0.0-alpha - 2.0.0-beta')).toBe(false)
      expect(satisfies('2.0.1', '1.0.0-alpha - 2.0.0-beta')).toBe(false)
    })
  })

  describe('build metadata', () => {
    it('should ignore build metadata in version', () => {
      expect(satisfies('1.0.0+build', '^1.0.0')).toBe(true)
      expect(satisfies('1.0.0+20130313144700', '>=1.0.0')).toBe(true)
      expect(satisfies('1.0.0+build.123', '1.0.0')).toBe(true)
    })

    it('should ignore build metadata in range', () => {
      expect(satisfies('1.0.0', '1.0.0+build')).toBe(true)
      expect(satisfies('1.0.0', '^1.0.0+build')).toBe(true)
    })

    it('should handle prerelease with build metadata', () => {
      expect(satisfies('1.0.0-alpha+build', '1.0.0-alpha')).toBe(true)
      expect(satisfies('1.0.0-alpha', '1.0.0-alpha+build')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should return false for invalid versions', () => {
      expect(satisfies('invalid', '1.0.0')).toBe(false)
      expect(satisfies('1.0', '1.0.0')).toBe(false)
      expect(satisfies('', '1.0.0')).toBe(false)
    })

    it('should return false for invalid ranges', () => {
      expect(satisfies('1.0.0', 'invalid')).toBe(false)
      expect(satisfies('1.0.0', '>>1.0.0')).toBe(false)
      expect(satisfies('1.0.0', '><1.0.0')).toBe(false)
      // Unknown operator
      expect(satisfies('1.0.0', '!1.0.0')).toBe(false)
      // Only operator without version
      expect(satisfies('1.0.0', '>')).toBe(false)
      expect(satisfies('1.0.0', '>=')).toBe(false)
      expect(satisfies('1.0.0', '<')).toBe(false)
    })

    it('should handle whitespace in range', () => {
      expect(satisfies('1.0.0', ' 1.0.0 ')).toBe(true)
      expect(satisfies('1.0.0', ' ^1.0.0 ')).toBe(true)
      expect(satisfies('1.5.0', '  >=1.0.0   <2.0.0  ')).toBe(true)
    })

    it('should handle empty range as wildcard', () => {
      expect(satisfies('1.0.0', '')).toBe(true)
      expect(satisfies('0.0.1', '')).toBe(true)
    })

    it('should handle 0.0.0 version', () => {
      expect(satisfies('0.0.0', '*')).toBe(true)
      expect(satisfies('0.0.0', '>=0.0.0')).toBe(true)
      expect(satisfies('0.0.0', '^0.0.0')).toBe(true)
      expect(satisfies('0.0.1', '^0.0.0')).toBe(false)
    })

    it('should handle large version numbers', () => {
      expect(satisfies('999.999.999', '>=1.0.0')).toBe(true)
      expect(satisfies('999.999.999', '<1000.0.0')).toBe(true)
    })
  })

  describe('complex combinations', () => {
    it('should handle realistic npm ranges', () => {
      expect(satisfies('16.8.0', '^16.8.0 || ^17.0.0 || ^18.0.0')).toBe(true)
      expect(satisfies('17.0.2', '^16.8.0 || ^17.0.0 || ^18.0.0')).toBe(true)
      expect(satisfies('18.2.0', '^16.8.0 || ^17.0.0 || ^18.0.0')).toBe(true)
      expect(satisfies('15.0.0', '^16.8.0 || ^17.0.0 || ^18.0.0')).toBe(false)
    })

    it('should handle mixed operators', () => {
      expect(satisfies('1.2.3', '>=1.0.0 <1.3.0 || >=2.0.0')).toBe(true)
      expect(satisfies('2.5.0', '>=1.0.0 <1.3.0 || >=2.0.0')).toBe(true)
      expect(satisfies('1.5.0', '>=1.0.0 <1.3.0 || >=2.0.0')).toBe(false)
    })

    it('should handle combined caret and tilde', () => {
      expect(satisfies('1.2.5', '^1.2.3 || ~2.0.0')).toBe(true)
      expect(satisfies('2.0.5', '^1.2.3 || ~2.0.0')).toBe(true)
      expect(satisfies('2.1.0', '^1.2.3 || ~2.0.0')).toBe(false)
    })

    it('should handle hyphen ranges with OR', () => {
      expect(satisfies('1.5.0', '1.0.0 - 2.0.0 || 3.0.0 - 4.0.0')).toBe(true)
      expect(satisfies('3.5.0', '1.0.0 - 2.0.0 || 3.0.0 - 4.0.0')).toBe(true)
      expect(satisfies('2.5.0', '1.0.0 - 2.0.0 || 3.0.0 - 4.0.0')).toBe(false)
    })
  })

  describe('node-semver compatibility', () => {
    it('should match node-semver behavior for common ranges', () => {
      expect(satisfies('1.2.3', '^1.2.3')).toBe(true)
      expect(satisfies('1.2.4', '^1.2.3')).toBe(true)
      expect(satisfies('1.3.0', '^1.2.3')).toBe(true)
      expect(satisfies('2.0.0', '^1.2.3')).toBe(false)

      expect(satisfies('1.2.3', '~1.2.3')).toBe(true)
      expect(satisfies('1.2.4', '~1.2.3')).toBe(true)
      expect(satisfies('1.3.0', '~1.2.3')).toBe(false)

      expect(satisfies('1.2.3', '1.2.x')).toBe(true)
      expect(satisfies('1.2.0', '1.2.x')).toBe(true)
      expect(satisfies('1.3.0', '1.2.x')).toBe(false)

      expect(satisfies('1.2.3', '>=1.2.3 <1.3.0')).toBe(true)
      expect(satisfies('1.2.4', '>=1.2.3 <1.3.0')).toBe(true)
      expect(satisfies('1.3.0', '>=1.2.3 <1.3.0')).toBe(false)
    })

    it('should match node-semver prerelease behavior', () => {
      expect(satisfies('1.2.3-alpha.7', '>1.2.3-alpha.3')).toBe(true)
      expect(satisfies('3.4.5-alpha.9', '>1.2.3-alpha.3', { includePrerelease: false })).toBe(false)
      expect(satisfies('3.4.5', '>1.2.3-alpha.3')).toBe(true)
    })
  })
})
