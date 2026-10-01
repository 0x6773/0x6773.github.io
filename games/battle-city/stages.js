(function (root) {
  'use strict';

  root.BattleCityStages = [
    {
      name: 'Outpost',
      mix: [18, 2, 0, 0],
      map: [
        '.............',
        '.BB.BB.BB.BB.',
        '.BB.BB.BB.BB.',
        '.............',
        'B..BBB.BBB..B',
        'B...........B',
        '..S.BB.BB.S..',
        '....B...B....',
        '.BB.B.B.B.BB.',
        '.BB...B...BB.',
        '......B......',
        '.B.B.....B.B.',
        '.............'
      ]
    },
    {
      name: 'River Crossing',
      mix: [14, 4, 2, 0],
      map: [
        '.............',
        '.BB.......BB.',
        '.BB.BBBBB.BB.',
        '....B...B....',
        'SS..B.S.B..SS',
        '.............',
        'WW.WWW.WWW.WW',
        '.............',
        '.B.BB...BB.B.',
        '.B..B.B.B..B.',
        '.BB...B...BB.',
        '..B.......B..',
        '.............'
      ]
    },
    {
      name: 'Steel Posts',
      mix: [12, 4, 2, 2],
      map: [
        '.............',
        '.S.BB...BB.S.',
        '.S.BB.B.BB.S.',
        '......B......',
        'BB.S.BBB.S.BB',
        '...S.....S...',
        '.B...S.S...B.',
        '.BBB.....BBB.',
        '...S.B.B.S...',
        'BB.S.B.B.S.BB',
        '.....B.B.....',
        '.SB.......BS.',
        '.............'
      ]
    },
    {
      name: 'Forest',
      mix: [10, 5, 3, 2],
      map: [
        '.............',
        '.TTT.BBB.TTT.',
        '.TTT.B.B.TTT.',
        '.TT...T...TT.',
        'B...BTTTB...B',
        'BB..BTTTB..BB',
        '..T.......T..',
        'TTTT.BBB.TTTT',
        'TT.B.....B.TT',
        '...B.TTT.B...',
        '.BB..TTT..BB.',
        '.BTT.....TTB.',
        '.............'
      ]
    },
    {
      name: 'Ice Lake',
      mix: [8, 5, 4, 3],
      map: [
        '.............',
        '.BBB.....BBB.',
        '.B.........B.',
        '...IIIIIII...',
        '.SIIIBBBIIIS.',
        '..IIIB.BIII..',
        'B.IIIIIIIII.B',
        'B.III.S.III.B',
        '..IIIIIIIII..',
        '.BBB.III.BBB.',
        '...B.....B...',
        '.B.B.....B.B.',
        '.............'
      ]
    },
    {
      name: 'Bunkers',
      mix: [6, 6, 4, 4],
      map: [
        '.............',
        '.SSS.....SSS.',
        '.SBS.BBB.SBS.',
        '.S.S.B.B.S.S.',
        '.............',
        'BB.BB.S.BB.BB',
        'BB.BB...BB.BB',
        '......S......',
        '.SSS.BBB.SSS.',
        '.SBS.B.B.SBS.',
        '.S.S.....S.S.',
        '..B.......B..',
        '.............'
      ]
    },
    {
      name: 'Canals',
      mix: [6, 4, 6, 4],
      map: [
        '.............',
        '.W.BB.B.BB.W.',
        '.W.B..B..B.W.',
        '.W...BBB...W.',
        '.W.B.....B.W.',
        '...B.W.W.B...',
        'BB...W.W...BB',
        '...B.W.W.B...',
        '.W.B.....B.W.',
        '.W...BBB...W.',
        '.W.B.....B.W.',
        '...B.....B...',
        '.............'
      ]
    },
    {
      name: 'Maze',
      mix: [4, 6, 5, 5],
      map: [
        '.............',
        '.BBBBB.BBBBB.',
        '.B.........B.',
        '.B.BBB.BBB.B.',
        '.B.B.....B.B.',
        '...B.BBB.B...',
        'BBBB.B.B.BBBB',
        '...B.....B...',
        '.B.BBB.BBB.B.',
        '.B.........B.',
        '.BBB.B.B.BBB.',
        '..B.......B..',
        '.............'
      ]
    },
    {
      name: 'Fortress',
      mix: [4, 4, 6, 6],
      map: [
        '.............',
        '.B.B.....B.B.',
        '.B.B.SSS.B.B.',
        '.....SBS.....',
        'BBB..SBS..BBB',
        '..B.......B..',
        '..B.SS.SS.B..',
        '....S...S....',
        '.BB.S.B.S.BB.',
        '.BB...B...BB.',
        '..S.BBBBB.S..',
        '..S.......S..',
        '.............'
      ]
    },
    {
      name: 'Checkerboard',
      mix: [2, 6, 6, 6],
      map: [
        '.............',
        '.U.U.U.U.U.U.',
        '.D.D.D.D.D.D.',
        'U.U.U.U.U.U.U',
        'D.D.D.D.D.D.D',
        '.L.R.L.R.L.R.',
        '.............',
        '.SS.BBBBB.SS.',
        '.............',
        '.B.B.B.B.B.B.',
        '.R.L.R.L.R.L.',
        '.B.B.....B.B.',
        '..B.......B..'
      ]
    },
    {
      name: 'Islands',
      mix: [2, 4, 6, 8],
      map: [
        '.............',
        '..WWW...WWW..',
        '.WWBWW.WWBWW.',
        '.WBBBW.WBBBW.',
        '.WWBWW.WWBWW.',
        '..WWW...WWW..',
        'B...........B',
        'BB.BB.S.BB.BB',
        '..WWW...WWW..',
        '.WW.......WW.',
        '.W..BB.BB..W.',
        '...B.....B...',
        '.............'
      ]
    },
    {
      name: 'Diagonals',
      mix: [0, 6, 6, 8],
      map: [
        '.............',
        '..B.......B..',
        '...B.....B...',
        '....B...B....',
        '.S...B.B...S.',
        'B.....T.....B',
        'BB...T.T...BB',
        '.....TTT.....',
        '..B.......B..',
        '.B.B.SSS.B.B.',
        'B...B...B...B',
        '..B.......B..',
        '.............'
      ]
    },
    {
      name: 'Gauntlet',
      mix: [0, 4, 8, 8],
      map: [
        '.............',
        '.S.SBBBBBS.S.',
        '.S.S.....S.S.',
        '.S.S.BBB.S.S.',
        '...S.B.B.S...',
        'BB.........BB',
        '...SS.B.SS...',
        '...S..B..S...',
        '.BBS.BBB.SBB.',
        '.B.........B.',
        '.B.SBB.BBS.B.',
        '...S.....S...',
        '.............'
      ]
    },
    {
      name: 'Jungle River',
      mix: [0, 4, 6, 10],
      map: [
        '.............',
        '.TT.BB.BB.TT.',
        '.TTTB...BTTT.',
        '..TT.....TT..',
        'WW..TT.TT..WW',
        'WWW.TT.TT.WWW',
        '....B...B....',
        '.BB.B.T.B.BB.',
        '..T...T...T..',
        'TTT.BBBBB.TTT',
        '.T.........T.',
        '.BB.......BB.',
        '.............'
      ]
    },
    {
      name: 'Last Stand',
      mix: [0, 2, 8, 10],
      map: [
        '.............',
        '.SBS.BBB.SBS.',
        '.B.B.B.B.B.B.',
        '.SBS.....SBS.',
        '...WW.S.WW...',
        'BB.W.....W.BB',
        '...B.III.B...',
        'SB.B.I.I.B.BS',
        '...B.III.B...',
        '.BBB.....BBB.',
        '..S.BB.BB.S..',
        '.BS.......SB.',
        '.............'
      ]
    }
  ];

  root.BattleCityStages.loopMix = [0, 2, 6, 12];
})(typeof window !== 'undefined' ? window : globalThis);
