// flex.js — プロデザイン仕様の LINE Flex Message ビルダー（クリーン／清潔感バージョン）
//
// 方針：白 × アイボリーを基調に、ゴールドは細いアクセントとして最小限に。
// 余白を広くとり、上質で清潔感のある不動産ブランドの見え方を LINE 上で再現します。
// ブランドの象徴として、ヒーローの見出し帯だけダーク（黒 × ゴールド）を残しています。

import { COMPANY, SERVICES, MENU, getService } from './faq.js';

// ── カラートークン ─────────────────────────────────────────────
const C = {
  white: '#FFFFFF',   // カード面
  ivory: '#FAF8F3',   // 補助面（情報ボックス等）
  ink: '#1C1C20',     // 本文（濃い墨）
  sub: '#726E66',     // 補助文字
  gold: '#C2A24C',    // ゴールド（ボタン・帯）
  goldDeep: '#A6812C', // 白地で読みやすい濃いゴールド（ラベル文字）
  line: '#ECE7DC',    // ヘアライン
  band: '#101013',    // ヒーロー見出し帯（ダーク）
  paper: '#F4F0E8',   // ダーク帯の上の文字
};

function telUri() {
  return /\d/.test(COMPANY.tel) ? `tel:${COMPANY.tel.replace(/[^\d+]/g, '')}` : COMPANY.site;
}
function mapUri() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY.address)}`;
}

// ── 小さな部品 ─────────────────────────────────────────────────
const eyebrow = (text, align = 'center') => ({
  type: 'text', text, size: 'xs', color: C.goldDeep, weight: 'bold', align,
});
const goldRule = (align = 'center') => ({
  type: 'box', layout: 'vertical', height: '2px', width: '36px',
  backgroundColor: C.gold, cornerRadius: '2px',
  ...(align === 'center' ? { alignItems: 'center' } : {}),
});
// 中央寄せの細いゴールドライン
const goldRuleCentered = (margin = 'md') => ({
  type: 'box', layout: 'vertical', margin, alignItems: 'center',
  contents: [goldRule()],
});

const primaryBtn = (label, action) => ({
  type: 'button', style: 'primary', color: C.gold, height: 'sm', action,
});
const softBtn = (label, action) => ({
  type: 'button', style: 'secondary', color: C.ivory, height: 'sm', action,
});

// クイックリプライ（テキスト返信の下部メニュー）
export function quickReply() {
  return {
    items: MENU.map((m) => ({
      type: 'action',
      action: { type: 'message', label: m.label, text: m.text },
    })),
  };
}

// ── ① あいさつ（友だち追加）ヒーローバブル ────────────────────
export function greetingHero() {
  return {
    type: 'flex',
    altText: `${COMPANY.name} 公式アカウントへようこそ`,
    contents: {
      type: 'bubble', size: 'mega',
      // ブランド帯（ダーク）
      header: {
        type: 'box', layout: 'vertical', backgroundColor: C.band, paddingAll: '22px', spacing: 'xs',
        contents: [
          { type: 'text', text: '◈', size: 'xl', color: C.gold, align: 'center' },
          { type: 'text', text: 'MARTIAL ARTS', size: 'md', color: '#FFFFFF', weight: 'bold', align: 'center', margin: 'sm' },
          { type: 'text', text: 'REAL ESTATE & CONSTRUCTION', size: 'xxs', color: C.gold, align: 'center', margin: 'xs' },
        ],
      },
      // 本文（白・広い余白）
      body: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '26px', spacing: 'none',
        contents: [
          { type: 'text', text: COMPANY.tagline, size: 'xl', color: C.ink, weight: 'bold', align: 'center', wrap: true },
          goldRuleCentered('lg'),
          { type: 'text', text: COMPANY.catch, size: 'sm', color: C.sub, align: 'center', wrap: true, margin: 'lg' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '22px', spacing: 'sm',
        contents: [
          primaryBtn('サービスを見る', { type: 'message', label: 'サービスを見る', text: 'サービス一覧' }),
          { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
            softBtn('無料相談', { type: 'message', label: '無料相談', text: '無料相談' }),
            softBtn('電話する', { type: 'uri', label: '電話する', uri: telUri() }),
          ]},
        ],
      },
      styles: { header: { separator: false }, footer: { separator: false } },
    },
  };
}

// ── ② サービスカルーセル（6事業） ──────────────────────────────
function serviceBubble(s) {
  return {
    type: 'bubble', size: 'kilo',
    body: {
      type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '20px', spacing: 'none',
      contents: [
        { type: 'text', text: s.icon, size: 'xxl', align: 'center' },
        { type: 'text', text: s.tag, size: 'xxs', color: C.goldDeep, weight: 'bold', align: 'center', margin: 'md' },
        { type: 'text', text: s.label, size: 'md', color: C.ink, weight: 'bold', align: 'center', wrap: true, margin: 'sm' },
        goldRuleCentered('md'),
        { type: 'text', text: s.short, size: 'xs', color: C.sub, wrap: true, margin: 'lg', align: 'center' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '20px',
      contents: [primaryBtn('詳しく見る', { type: 'message', label: '詳しく見る', text: s.label })],
    },
  };
}

export function serviceCarousel() {
  return {
    type: 'flex',
    altText: `${COMPANY.name} のサービス一覧`,
    contents: { type: 'carousel', contents: SERVICES.map(serviceBubble) },
  };
}

// ── ③ サービス詳細バブル ───────────────────────────────────────
export function serviceDetail(serviceId) {
  const s = getService(serviceId);
  if (!s) return null;
  const lines = s.detail.split('\n');
  const title = lines[0].replace(/[【】]/g, '');
  const bodyText = lines.slice(1).join('\n').trim();
  return {
    type: 'flex',
    altText: s.label,
    contents: {
      type: 'bubble', size: 'mega',
      // 上部に細いゴールドの帯（清潔感のあるアクセント）
      header: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '22px', paddingBottom: '0px', spacing: 'xs',
        contents: [
          { type: 'box', layout: 'vertical', height: '3px', width: '44px', backgroundColor: C.gold, cornerRadius: '2px' },
          { type: 'text', text: s.tag, size: 'xxs', color: C.goldDeep, weight: 'bold', margin: 'lg' },
          { type: 'text', text: `${s.icon}  ${title}`, size: 'lg', color: C.ink, weight: 'bold', wrap: true, margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '22px', paddingTop: '16px',
        contents: [{ type: 'text', text: bodyText, size: 'sm', color: C.ink, wrap: true, lineSpacing: '6px' }],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '20px', spacing: 'sm',
        contents: [
          primaryBtn('この件で相談する', { type: 'message', label: '相談する', text: '無料相談' }),
          softBtn('サービス一覧へ', { type: 'message', label: 'サービス一覧', text: 'サービス一覧' }),
        ],
      },
      styles: { header: { separator: false }, footer: { separator: false } },
    },
  };
}

// ── ④ 無料相談・査定 CTA カード ────────────────────────────────
export function ctaCard() {
  return {
    type: 'flex',
    altText: '無料相談・査定のご案内',
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '26px', spacing: 'none',
        contents: [
          eyebrow('FREE CONSULTATION'),
          { type: 'text', text: 'まずは無料でご相談', size: 'xl', color: C.ink, weight: 'bold', align: 'center', margin: 'md', wrap: true },
          goldRuleCentered('lg'),
          { type: 'text', text: '査定・お見積り・住まいのお悩みまで、お気軽に。オンライン相談も承ります。', size: 'sm', color: C.sub, align: 'center', wrap: true, margin: 'lg' },
          { type: 'box', layout: 'vertical', backgroundColor: C.ivory, cornerRadius: '10px', paddingAll: '16px', margin: 'xl', spacing: 'sm',
            borderWidth: '1px', borderColor: C.line,
            contents: [
              { type: 'text', text: 'このトークに送るだけ', size: 'xs', color: C.goldDeep, weight: 'bold' },
              { type: 'text', text: '① ご相談内容（例：自宅の売却査定）\n② お名前\n③ ご連絡先', size: 'sm', color: C.ink, wrap: true, lineSpacing: '5px' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '22px', spacing: 'sm',
        contents: [
          primaryBtn('電話で相談', { type: 'uri', label: '電話で相談', uri: telUri() }),
          softBtn('公式サイトから', { type: 'uri', label: '公式サイト', uri: COMPANY.site }),
        ],
      },
      styles: { footer: { separator: false } },
    },
  };
}

// ── ⑤ 連絡先カード ─────────────────────────────────────────────
function infoRow(label, value) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'md', margin: 'none',
    contents: [
      { type: 'text', text: label, size: 'xs', color: C.goldDeep, flex: 2, weight: 'bold' },
      { type: 'text', text: value, size: 'sm', color: C.ink, flex: 5, wrap: true },
    ],
  };
}

export function contactCard() {
  return {
    type: 'flex',
    altText: `${COMPANY.name} 連絡先`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '26px', spacing: 'none',
        contents: [
          eyebrow('CONTACT'),
          { type: 'text', text: COMPANY.name, size: 'lg', color: C.ink, weight: 'bold', align: 'center', margin: 'md', wrap: true },
          goldRuleCentered('lg'),
          { type: 'box', layout: 'vertical', spacing: 'lg', margin: 'xl', contents: [
            infoRow('TEL', COMPANY.tel),
            infoRow('受付', COMPANY.hours),
            infoRow('所在地', COMPANY.address),
            infoRow('アクセス', COMPANY.access),
          ]},
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '22px', spacing: 'sm',
        contents: [
          primaryBtn('電話する', { type: 'uri', label: '電話する', uri: telUri() }),
          { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
            softBtn('地図', { type: 'uri', label: '地図', uri: mapUri() }),
            softBtn('公式サイト', { type: 'uri', label: '公式サイト', uri: COMPANY.site }),
          ]},
        ],
      },
      styles: { footer: { separator: false } },
    },
  };
}

// ── ⑥ アクセスカード ───────────────────────────────────────────
export function accessCard() {
  return {
    type: 'flex',
    altText: `${COMPANY.name} アクセス`,
    contents: {
      type: 'bubble', size: 'mega',
      body: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingAll: '26px', spacing: 'none',
        contents: [
          eyebrow('ACCESS'),
          { type: 'text', text: '本社アクセス', size: 'xl', color: C.ink, weight: 'bold', align: 'center', margin: 'md' },
          goldRuleCentered('lg'),
          { type: 'text', text: COMPANY.address, size: 'sm', color: C.ink, align: 'center', wrap: true, margin: 'xl' },
          { type: 'text', text: COMPANY.access, size: 'xs', color: C.goldDeep, weight: 'bold', align: 'center', wrap: true, margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: C.white, paddingStart: '20px', paddingEnd: '20px', paddingBottom: '22px',
        contents: [primaryBtn('地図を開く', { type: 'uri', label: '地図を開く', uri: mapUri() })],
      },
      styles: { footer: { separator: false } },
    },
  };
}

// server.js から名前で解決するためのレジストリ
export const FLEX_BUILDERS = {
  greetingHero,
  serviceCarousel,
  serviceDetail,
  ctaCard,
  contactCard,
  accessCard,
};
