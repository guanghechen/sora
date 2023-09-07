export function stringEncaseCRLFWithFirstIndex(
  text: string,
  prefix: string,
  postfix: string,
  index_: number,
): string {
  let endIndex = 0
  let returnValue = ''
  let index = index_
  do {
    const gotCR = text[index - 1] === '\r'
    returnValue +=
      text.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? '\r\n' : '\n') + postfix
    endIndex = index + 1
    index = text.indexOf('\n', endIndex)
  } while (index !== -1)

  returnValue += text.slice(endIndex)
  return returnValue
}
