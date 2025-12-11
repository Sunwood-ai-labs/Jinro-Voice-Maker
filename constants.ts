/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { IntroStyle } from './types';

export const INTRO_STYLES: IntroStyle[] = [
  // --- DISCUSSION MODES ---
  {
    id: 'discussion_night',
    name: '夜の会話',
    type: 'discussion',
    description: `Night Conversation (夜の会話)
# SCENE: The Secret Meeting
人狼たちの密談、あるいは孤独な役職者の独白。静かで不気味な夜の空気を生成します。

### USAGE
シチュエーションを入力すると、複数の役職による掛け合い台本を作成します。`,
    defaultVoice: 'Puck', // Placeholder
    color: 'blue',
    icon: 'half-circle',
    templateText: `夜のターン。人狼たちが誰を襲撃するか相談している。ターゲットはまだ決まっていない。`
  },
  {
    id: 'discussion_day',
    name: '昼の議論',
    type: 'discussion',
    description: `Day Discussion (昼の議論)
# SCENE: The Heated Debate
処刑者を決めるための緊迫した議論。疑心暗鬼、告発、弁明が飛び交う激しい応酬を生成します。

### USAGE
議題（例：占い師の対立）を入力すると、緊迫した議論台本を作成します。`,
    defaultVoice: 'Puck', // Placeholder
    color: 'yellow',
    icon: 'circle',
    templateText: `占い師を名乗る二人が互いに人狼だと主張し、村人たちが混乱している状況。`
  },
  // --- ROLES ---
  {
    id: 'gamemaster',
    name: 'ゲームマスター',
    type: 'role',
    description: `The Game Master (ゲームマスター)
# AUDIO PROFILE: The Narrator
## "The Voice of Fate" (運命の声)

## The Scene: 深夜の洋館
薄暗い照明、キャンドルの炎が揺れる古い洋館の広間。プレイヤーたちの緊張感が漂う中、すべてを見通す神の視点から物語を紡ぐ。感情に流されず、しかしドラマチックに状況を描写する。`,
    defaultVoice: 'Alnilam',
    color: 'black',
    icon: 'square',
    templateText: `恐ろしい夜が明けました。昨晩、無残な姿で発見されたのは... あなたです。`
  },
  {
    id: 'werewolf',
    name: '人狼',
    type: 'role',
    description: `The Werewolf (人狼)
# AUDIO PROFILE: The Deceiver
## "Wolf in Sheep's Clothing" (羊の皮を被った狼)

## THE SCENE: 昼間の議論
村人たちに混ざって正体を隠している。表面上は協力的で論理的に見えるが、言葉の端々に計算高さと、獲物を追い詰める冷酷さが潜む。`,
    defaultVoice: 'Algenib',
    color: 'red',
    icon: 'triangle',
    templateText: "え、僕を疑うの？おかしいな。僕は昨夜ずっと静かにしてたよ。それに、今の発言... 焦ってるように見えるのは、君の方じゃない？"
  },
  {
    id: 'seer',
    name: '占い師',
    type: 'role',
    description: `The Seer (占い師)
# AUDIO PROFILE: The Truth Teller
## "The Desperate Prophet" (必死の予言者)

## The Scene: 緊迫した告発
自分が唯一の真実を知っているが、誰も信じてくれないかもしれない焦燥感。水晶玉（あるいは神託）で見た結果を、命懸けで伝えようとする。`,
    defaultVoice: 'Kore',
    color: 'blue',
    icon: 'circle',
    templateText: "私の水晶玉は嘘をつきません！昨夜占った結果... 彼こそが人狼です！皆さん、目を覚ましてください！今彼を吊らないと、我々は全滅します！"
 },
 {
    id: 'madman',
    name: '狂人',
    type: 'role',
    description: `The Madman (狂人)
# AUDIO PROFILE: The Chaos Agent
## "The Devoted Follower" (狂信的な信奉者)

## The Scene: 混乱の渦中
人狼を勝利に導くためなら、自分が嘘の占い師を名乗ることも、処刑されることも厭わない。論理よりも感情、秩序よりも混沌を好む。`,
    defaultVoice: 'Fenrir',
    color: 'yellow',
    icon: 'plus',
    templateText: "あははは！素晴らしい夜だ！そう、私こそが真の占い師だ... ということにしておこうか？それとも人狼かな？さあ、どっちだと思う？もっと疑い合え！"
 },
 {
    id: 'villager',
    name: '村人',
    type: 'role',
    description: `The Villager (村人)
# AUDIO PROFILE: The Innocent
## "The Scared Citizen" (怯える市民)

## The Scene: 疑心暗鬼の村
特殊な能力を持たない一般人。誰が味方かわからない恐怖と、自分が疑われるかもしれない不安の中にいる。`,
    defaultVoice: 'Leda',
    color: 'green',
    icon: 'circle',
    templateText: "信じて！私はただの村人なの！何も知らないの！昨夜はずっと震えてただけ... お願い、私を殺さないで！"
 },
 {
    id: 'medium',
    name: '霊媒師',
    type: 'role',
    description: `The Medium (霊媒師)
# AUDIO PROFILE: The Spirit Channeler
## "Voice of the Dead" (死者の声)

## The Scene: 厳粛な朝
昨夜処刑された者が人間だったのか、人狼だったのか。死者の魂と交信し、その結果を淡々と、あるいは悲しげに伝える。`,
    defaultVoice: 'Umbriel',
    color: 'blue',
    icon: 'half-circle',
    templateText: "死者の声が聞こえます... 昨夜、我々の手で葬られたあの者は... 人間ではありませんでした。霊魂が、獣の姿をして彷徨っています。"
 }
];

export const CUSTOM_STYLE: IntroStyle = {
  id: 'custom',
  name: 'カスタム設定',
  type: 'role',
  description: '独自の役職やシチュエーションを設定します。',
  defaultVoice: 'Puck',
  color: 'white',
  icon: 'plus',
  templateText: "ここにセリフを入力し、上のスタイルを選択して『✨ 演技指導』をクリックすると... その役職になりきって書き直されます。",
};

export const SUPPORTED_LANGUAGES = [
  { name: '日本語 (日本)', code: 'ja-JP' },
  { name: '英語 (アメリカ)', code: 'en-US' },
  { name: '英語 (イギリス)', code: 'en-GB' },
  { name: '中国語、北京語 (中国)', code: 'cmn-CN' },
  { name: '韓国語 (韓国)', code: 'ko-KR' },
  { name: 'フランス語 (フランス)', code: 'fr-FR' },
  { name: 'ドイツ語 (ドイツ)', code: 'de-DE' },
  { name: 'イタリア語 (イタリア)', code: 'it-IT' },
  { name: 'スペイン語 (スペイン)', code: 'es-ES' },
  { name: 'ロシア語 (ロシア)', code: 'ru-RU' },
];