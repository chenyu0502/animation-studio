// 範例劇本：沒有 Gemini 金鑰也能先玩，也是引擎的測試資料。
export const SAMPLES = [
  {
    prompt: '三隻貓在海邊搶一條魚，最後一起分著吃',
    script: {
      title: '海邊搶魚大作戰', duration: 12, mood: 'playful', scene: 'beach', time: 'day', weather: 'none',
      characters: [
        { id: 'orange', kind: 'cat', name: '小橘', color: 'orange', x: 15, facing: 'right' },
        { id: 'black', kind: 'cat', name: '小黑', color: 'black', x: 82, facing: 'left' },
        { id: 'white', kind: 'cat', name: '小白', color: 'white', size: 'small', x: 60, facing: 'left' },
      ],
      props: [{ id: 'fish', kind: 'fish', x: 50 }],
      actions: [
        { t: 0.4, who: 'orange', do: 'sneak', to: 'fish', dur: 2.2 },
        { t: 2.7, who: 'orange', do: 'pickup', prop: 'fish' },
        { t: 3.0, who: 'black', do: 'surprised' },
        { t: 3.7, who: 'black', do: 'chase', to: 'orange', dur: 1.5 },
        { t: 3.6, who: 'orange', do: 'flee', to: 12, dur: 1.6 },
        { t: 5.4, who: 'black', do: 'talk', text: '那是我的魚！', dur: 1.6 },
        { t: 5.6, who: 'white', do: 'walk', to: 40, dur: 1.4 },
        { t: 7.1, who: 'white', do: 'talk', text: '一起吃吧～', dur: 1.5 },
        { t: 8.8, who: 'orange', do: 'eat', prop: 'fish', dur: 2.0 },
        { t: 8.8, who: 'black', do: 'laugh', dur: 1.5 },
        { t: 9.0, who: 'white', do: 'cheer', dur: 2.0 },
      ],
      camera: [
        { t: 0, shot: 'wide' }, { t: 2.4, shot: 'close', on: 'orange' }, { t: 3.6, shot: 'wide' },
        { t: 5.4, shot: 'medium', on: 'black' }, { t: 7.0, shot: 'medium', on: 'white' }, { t: 8.7, shot: 'wide' },
      ],
      captions: [{ t: 0.2, dur: 2, text: '海邊的午後', pos: 'top' }, { t: 10.2, dur: 1.8, text: '分享最好吃！', pos: 'top' }],
      effects: [{ t: 9.2, kind: 'hearts', at: 'white' }, { t: 10.2, kind: 'sparkle', at: 'orange' }],
    },
  },
  {
    prompt: '兩個小朋友在雪地裡打雪仗，最後一起堆雪人歡呼',
    script: {
      title: '雪地大戰', duration: 12, mood: 'happy', scene: 'snow', time: 'day',
      characters: [
        { id: 'a', kind: 'person', name: '阿哲', voice: 'boy', color: 'blue', hair: 'spiky', x: 20, facing: 'right' },
        { id: 'b', kind: 'person', name: '小涵', voice: 'girl', color: 'pink', hair: 'long', x: 78, facing: 'left' },
      ],
      props: [],
      actions: [
        { t: 0.3, who: 'a', do: 'wave', dur: 1.2 },
        { t: 1.6, who: 'a', do: 'throw', prop: 'snowball', target: 'b' },
        { t: 3.2, who: 'b', do: 'angry', dur: 1.0 },
        { t: 4.3, who: 'b', do: 'throw', prop: 'snowball', target: 'a' },
        { t: 5.6, who: 'a', do: 'fall', dur: 1.6 },
        { t: 7.4, who: 'b', do: 'run', to: 'a', dur: 1.0 },
        { t: 8.5, who: 'b', do: 'talk', text: '你還好嗎？', dur: 1.4 },
        { t: 10.0, who: 'a', do: 'cheer', dur: 2 },
        { t: 10.0, who: 'b', do: 'cheer', dur: 2 },
      ],
      camera: [{ t: 0, shot: 'wide' }, { t: 1.5, shot: 'medium', on: 'a' }, { t: 2.4, shot: 'wide' }, { t: 5.5, shot: 'close', on: 'a' }, { t: 7.3, shot: 'wide' }],
      captions: [{ t: 10.2, dur: 1.8, text: '下雪天，最開心！' }],
      effects: [{ t: 10.0, kind: 'confetti' }],
    },
  },
  {
    prompt: '小狗在公園追球，帶回來給主人',
    script: {
      title: '公園的球', duration: 10, mood: 'happy', scene: 'park', time: 'sunset',
      characters: [
        { id: 'kid', kind: 'person', name: '小明', voice: 'boy', color: 'green', hair: 'short', x: 20, facing: 'right' },
        { id: 'dog', kind: 'dog', name: '旺財', color: 'brown', x: 32, facing: 'right' },
      ],
      props: [{ id: 'ball', kind: 'ball', holder: 'kid' }],
      actions: [
        { t: 0.5, who: 'kid', do: 'talk', text: '旺財，去撿！', dur: 1.4 },
        { t: 2.0, who: 'kid', do: 'throw', prop: 'ball' },
        { t: 2.6, who: 'dog', do: 'run', to: 'ball', dur: 1.3 },
        { t: 4.0, who: 'dog', do: 'pickup', prop: 'ball' },
        { t: 4.9, who: 'dog', do: 'run', to: 'kid', dur: 1.3 },
        { t: 6.4, who: 'dog', do: 'give', prop: 'ball', target: 'kid' },
        { t: 7.8, who: 'kid', do: 'laugh', dur: 1.2 },
        { t: 7.8, who: 'dog', do: 'jump', dur: 0.8 },
        { t: 8.7, who: 'dog', do: 'dance', dur: 1.3 },
      ],
      camera: [{ t: 0, shot: 'medium', on: 'kid' }, { t: 2.5, shot: 'wide' }, { t: 4.8, shot: 'medium', on: 'dog' }, { t: 7.6, shot: 'wide' }],
      captions: [{ t: 8.4, dur: 1.6, text: '好狗狗！' }],
      effects: [{ t: 7.9, kind: 'hearts', at: 'dog' }],
    },
  },
];
