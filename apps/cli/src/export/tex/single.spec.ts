import type { Root } from 'mdast';
import { extractTaggedContent } from './single';

describe('extractTaggedContent', () => {
  it('no tagged content returns undefined', async () => {
    expect(
      extractTaggedContent(
        { type: 'root', children: [{ type: 'text', value: 'untagged content' }] },
        { id: 'test_tag', required: true },
        {},
      ),
    ).toEqual(undefined);
  });
  it('tagged content removed from tree and returned', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'block' as any,
          data: { tags: ['other_tag'] },
          children: [{ type: 'text', value: 'untagged content' }],
        },
        {
          type: 'block' as any,
          data: { tags: ['test_tag'] },
          children: [{ type: 'text', value: 'tagged content' }],
        },
        {
          type: 'block' as any,
          data: { tags: ['other_tag', 'test_tag'] },
          children: [{ type: 'text', value: 'also tagged content' }],
        },
      ],
    };
    expect(extractTaggedContent(tree, { id: 'test_tag' }, {})).toEqual({
      value: 'tagged content\n\nalso tagged content',
      imports: [],
      commands: [],
    });
    expect(tree).toEqual({
      type: 'root',
      children: [
        {
          type: 'block' as any,
          data: { tags: ['other_tag'] },
          children: [{ type: 'text', value: 'untagged content' }],
        },
        {
          type: 'block' as any,
          data: { tags: ['test_tag'] },
          children: [],
        },
        {
          type: 'block' as any,
          data: { tags: ['other_tag', 'test_tag'] },
          children: [],
        },
      ],
    });
  });
  it('tagged content meeting maximums passes', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'block' as any,
          data: { tags: ['test_tag'] },
          children: [{ type: 'text', value: 'tagged content' }],
        },
      ],
    };
    expect(
      extractTaggedContent(tree, { id: 'test_tag', max_chars: 1000, max_words: 100 }, {}),
    ).toEqual({ value: 'tagged content', imports: [], commands: [] });
  });
  it('exceeding max chars passes', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'block' as any,
          data: { tags: ['test_tag'] },
          children: [{ type: 'text', value: 'tagged content' }],
        },
      ],
    };
    expect(extractTaggedContent(tree, { id: 'test_tag', max_chars: 5 }, {})).toEqual({
      value: 'tagged content',
      imports: [],
      commands: [],
    });
  });
  it('exceeding max words passes', async () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'block' as any,
          data: { tags: ['test_tag'] },
          children: [{ type: 'text', value: 'tagged content' }],
        },
      ],
    };
    expect(extractTaggedContent(tree, { id: 'test_tag', max_words: 1 }, {})).toEqual({
      value: 'tagged content',
      imports: [],
      commands: [],
    });
  });
});
