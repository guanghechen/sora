export function isIpv4(rawValue: string): boolean {
  const parts = rawValue.split('.')
  if (parts.length !== 4) {
    return false
  }

  for (const part of parts) {
    if (part.length < 1 || !/^\d+$/.test(part)) {
      return false
    }

    if (part.length > 1 && part.startsWith('0')) {
      return false
    }

    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return false
    }
  }

  return true
}

function countIpv6Segments(
  part: string,
  allowIpv4Tail: boolean,
): { count: number; hasIpv4Tail: boolean } | null {
  if (!part) {
    return { count: 0, hasIpv4Tail: false }
  }

  const segments = part.split(':')
  let count = 0
  let hasIpv4Tail = false

  for (let i = 0; i < segments.length; ++i) {
    const segment = segments[i]
    const isLastSegment = i === segments.length - 1

    if (!segment) {
      return null
    }

    if (segment.includes('.')) {
      if (!allowIpv4Tail || !isLastSegment || hasIpv4Tail || !isIpv4(segment)) {
        return null
      }

      hasIpv4Tail = true
      count += 2
      continue
    }

    if (!/^[0-9A-Fa-f]{1,4}$/.test(segment)) {
      return null
    }

    count += 1
  }

  return { count, hasIpv4Tail }
}

export function isIpv6(rawValue: string): boolean {
  if (!rawValue || !/^[0-9A-Fa-f:.]+$/.test(rawValue)) {
    return false
  }

  const doubleColonCount = rawValue.split('::').length - 1
  if (doubleColonCount > 1) {
    return false
  }

  if (doubleColonCount === 0) {
    const full = countIpv6Segments(rawValue, true)
    return full !== null && full.count === 8
  }

  const [left, right] = rawValue.split('::')
  const leftPart = countIpv6Segments(left, right.length === 0)
  const rightPart = countIpv6Segments(right, true)
  if (!leftPart || !rightPart) {
    return false
  }

  const totalSegments = leftPart.count + rightPart.count
  return totalSegments < 8
}

export function isIp(rawValue: string): boolean {
  return isIpv4(rawValue) || isIpv6(rawValue)
}

export function isDomain(rawValue: string): boolean {
  if (rawValue.length < 1 || rawValue.length > 253 || rawValue.endsWith('.')) {
    return false
  }

  const labels = rawValue.split('.')
  if (labels.length < 2) {
    return false
  }

  if (labels.some(label => label.length < 1 || label.length > 63)) {
    return false
  }

  const labelPattern = /^[A-Za-z0-9-]+$/
  if (
    labels.some(label => !labelPattern.test(label) || label.startsWith('-') || label.endsWith('-'))
  ) {
    return false
  }

  const topLevelLabel = labels[labels.length - 1]
  return /[A-Za-z]/.test(topLevelLabel)
}
