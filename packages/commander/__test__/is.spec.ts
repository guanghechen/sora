import { isDomain, isIp, isIpv4, isIpv6 } from '../src'

describe('is', () => {
  describe('isIpv4', () => {
    it('should return true for valid ipv4', () => {
      expect(isIpv4('0.0.0.0')).toBe(true)
      expect(isIpv4('127.0.0.1')).toBe(true)
      expect(isIpv4('255.255.255.255')).toBe(true)
    })

    it('should return false for invalid ipv4', () => {
      expect(isIpv4('256.0.0.1')).toBe(false)
      expect(isIpv4('1.2.3')).toBe(false)
      expect(isIpv4('01.2.3.4')).toBe(false)
      expect(isIpv4('a.b.c.d')).toBe(false)
    })
  })

  describe('isIpv6', () => {
    it('should return true for valid ipv6', () => {
      expect(isIpv6('::1')).toBe(true)
      expect(isIpv6('2001:db8::1')).toBe(true)
      expect(isIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
      expect(isIpv6('::ffff:192.168.0.1')).toBe(true)
    })

    it('should return false for invalid ipv6', () => {
      expect(isIpv6('2001:::1')).toBe(false)
      expect(isIpv6('gggg::1')).toBe(false)
      expect(isIpv6('::ffff:256.0.0.1')).toBe(false)
      expect(isIpv6('')).toBe(false)
    })
  })

  describe('isIp', () => {
    it('should return true for valid ip', () => {
      expect(isIp('127.0.0.1')).toBe(true)
      expect(isIp('::1')).toBe(true)
    })

    it('should return false for invalid ip', () => {
      expect(isIp('example.com')).toBe(false)
      expect(isIp('localhost')).toBe(false)
    })
  })

  describe('isDomain', () => {
    it('should return true for valid domain', () => {
      expect(isDomain('example.com')).toBe(true)
      expect(isDomain('api.example.co.uk')).toBe(true)
      expect(isDomain('foo-bar.example.org')).toBe(true)
    })

    it('should return false for invalid domain', () => {
      expect(isDomain('localhost')).toBe(false)
      expect(isDomain('example')).toBe(false)
      expect(isDomain('-a.example.com')).toBe(false)
      expect(isDomain('example.com.')).toBe(false)
      expect(isDomain('127.0.0.1')).toBe(false)
    })
  })
})
