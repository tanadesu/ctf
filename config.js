export const C = {
  duration:900, initialCash:18000, inventoryCap:400, tickMs:250,
  goods:{materials:{name:'建設資材',base:95,cost:24,batch:5,cycle:8},parts:{name:'精密部品',base:180,cost:65,batch:3,cycle:10},fuel:{name:'燃料',base:115,cost:30,batch:5,cycle:10}},
  buildings:{
    materials:{name:'資材工場',cost:2200,materials:15,time:25,icon:'▥',effect:'8秒ごとに資材5個／生産費 ¥120'},
    parts:{name:'部品工場',cost:3000,materials:20,time:30,icon:'⚙',effect:'10秒ごとに部品3個／生産費 ¥195'},
    fuel:{name:'燃料工場',cost:2500,materials:15,time:25,icon:'◉',effect:'10秒ごとに燃料5個／生産費 ¥150'},
    logistics:{name:'物流拠点',cost:1500,materials:10,time:20,icon:'⇄',effect:'調査済み市場への参入が可能'},
    habitat:{name:'移住者滞在施設',cost:2200,materials:20,time:30,icon:'▤',effect:'待機定員60人・応募は全社共通で5秒に1人'},
    port:{name:'宇宙港',cost:3500,materials:35,time:45,icon:'↑',effect:'輸送船1隻を建造・繰り返し運航'}
  },
  markets:[{name:'セントラル市場',label:'CENTRAL EXCHANGE',factor:1,target:90,consume:1.2,supply:1,fee:2,entry:0,survey:0,time:0},
    {name:'沿岸工業圏',label:'COASTAL INDUSTRIES',factor:1.22,target:65,consume:1.1,supply:.85,fee:5,entry:1800,survey:600,time:25},
    {name:'高地輸送圏',label:'HIGHLAND TRANSPORT',factor:1.4,target:50,consume:.9,supply:.7,fee:9,entry:2600,survey:850,time:35}],
  marketCap:260, stockFloor:0, priceMin:.45,priceMax:2.2,elasticity:.8,spread:.08,tradeCap:90,tradeRefill:1.5,maxOrder:80,quoteLife:8,
  rocket:{cost:3000,materials:35,parts:30,time:90,capacity:30,fuel:15,operating:350,boarding:14,countdown:6,flight:35,maintenance:15,upgrade:2000,upgradeParts:12,maxLevel:3},
  applicantInterval:5, upgradeCost:1300, upgradeMaterials:12
};
