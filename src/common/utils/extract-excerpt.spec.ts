import { extractExcerpt } from './extract-excerpt';

describe('extractExcerpt', () => {
  it('null body → 빈 문자열 반환', () => {
    expect(extractExcerpt(null)).toBe('');
    expect(extractExcerpt(undefined)).toBe('');
  });

  it('텍스트 노드 재귀 수집', () => {
    const body = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '안녕' },
            { type: 'text', text: '하세요' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' 포노입니다' }],
        },
      ],
    };
    expect(extractExcerpt(body)).toBe('안녕하세요 포노입니다');
  });

  it('150자 이하 → 그대로 반환', () => {
    const short = '짧은 텍스트';
    const body = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: short }] },
      ],
    };
    expect(extractExcerpt(body)).toBe(short);
  });

  it('150자 초과 → 150자 절삭 + ...' , () => {
    const longText = 'a'.repeat(200);
    const body = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: longText }] },
      ],
    };
    const result = extractExcerpt(body);
    expect(result).toBe('a'.repeat(150) + '...');
    expect(result.length).toBe(153);
  });

  it('content 없는 노드는 무시', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://example.com/img.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: '텍스트' }] },
      ],
    };
    expect(extractExcerpt(body)).toBe('텍스트');
  });
});
