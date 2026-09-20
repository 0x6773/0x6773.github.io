/* ======================================================
   Wordle – Complete Game Logic
   ====================================================== */

// ===== Word Lists =====
const ANSWER_WORDS = [
    "about","above","abuse","actor","acute","admit","adopt","adult","after","again",
    "agent","agree","ahead","alarm","album","alert","alien","align","alive","alley",
    "allow","alone","along","alter","among","angel","anger","angle","angry","anime",
    "ankle","apart","apple","apply","arena","argue","arise","armor","array","aside",
    "asset","atlas","avoid","awake","aware","badge","basic","basis","batch","beach",
    "beard","beast","begin","being","below","bench","berry","birth","black","blade",
    "blame","blank","blast","blaze","bleed","blend","bless","blind","block","blood",
    "bloom","blown","blues","blunt","board","boast","bonus","boost","bound","brain",
    "brand","brave","bread","break","breed","brick","brief","bring","broad","brown",
    "brush","buddy","build","bunch","burst","buyer","cabin","cable","candy","cargo",
    "carry","catch","cause","cease","chain","chair","chalk","champ","chaos","charm",
    "chart","chase","cheap","check","cheek","cheer","chess","chest","chief","child",
    "chill","chunk","civic","claim","clash","class","clean","clear","click","cliff",
    "climb","cling","clock","clone","close","cloth","cloud","coach","coast","color",
    "comet","comic","coral","count","court","cover","crack","craft","crane","crash",
    "crazy","cream","crime","crisp","cross","crowd","crown","crush","curve","cycle",
    "daily","dance","death","debug","decor","delay","delta","demon","depth","derby",
    "devil","diary","dirty","ditch","dizzy","dodge","donor","doubt","dough","draft",
    "drain","drake","drama","drank","drape","drawn","dream","dress","dried","drift",
    "drill","drink","drive","drone","drove","drown","dying","eager","eagle","earth",
    "eight","elder","elect","elite","email","empty","enemy","enjoy","enter","equal",
    "error","essay","event","every","exact","exile","exist","extra","faint","fairy",
    "faith","false","fault","feast","fence","fetch","fever","fiber","field","fifth",
    "fifty","fight","final","first","fixed","flame","flash","fleet","flesh","float",
    "flood","floor","flora","fluid","flush","focus","force","forge","forth","forum",
    "found","frame","frank","fraud","fresh","front","frost","fruit","fully","funny",
    "ghost","giant","given","glass","globe","glory","glove","grace","grade","grain",
    "grand","grant","graph","grasp","grass","grave","great","green","greet","grief",
    "grill","grind","gravy","gross","group","grove","grown","guard","guess","guest",
    "guide","guilt","guise","glyph","habit","happy","harsh","haven","heart","heavy",
    "hence","herbs","honey","honor","horse","hotel","house","human","humor","hurry",
    "ideal","image","imply","index","indie","inner","input","issue","ivory","jewel",
    "joint","joker","judge","juice","juicy",
    "knife","knock","known","label","large","laser","later","laugh","layer","learn",
    "least","leave","legal","lemon","level","light","limit","linen","liner","links",
    "liver","lobby","local","logic","loose","lover","lower","loyal","lucky","lunch",
    "lyric","magic","major","maker","manor","maple","march","marry","match","mayor",
    "media","mercy","merit","metal","meter","might","miner","minor","minus","mixer",
    "model","money","month","moral","motor","mount","mouse","mouth","movie","music",
    "naive","nerve","never","night","noble","noise","north","noted","novel","nurse",
    "nylon","occur","ocean","offer","olive","onset","opera","orbit","order","other",
    "outer","owner","oxide","ozone","paint","panel","panic","paper","party","paste",
    "patch","pause","peace","peach","pearl","penny","phase","phone","photo","piano",
    "piece","pilot","pinch","pitch","pixel","pizza","place","plain","plane","plant",
    "plate","plaza","plead","plumb","plume","plump","point","polar","pound","power",
    "press","price","pride","prime","print","prior","prize","proof","proud","prove",
    "psalm","pulse","punch","pupil","purse","queen","query","quest","queue","quick",
    "quiet","quota","quote","radar","radio","raise","rally","ranch","range","rapid",
    "ratio","reach","realm","rebel","reign","relax","reply","rider","ridge","rifle",
    "right","rigid","rinse","risky","rival","river","robin","robot","rocky","rogue",
    "roman","rough","round","route","royal","rugby","ruler","rural","saint","salad",
    "sauce","scale","scare","scene","scope","score","scout","screw","seize","sense",
    "serve","seven","shade","shall","shame","shape","share","shark","sharp","sheep",
    "sheer","sheet","shelf","shell","shift","shine","shirt","shock","shore","short",
    "shout","sight","silly","since","sixth","sixty","sized","skill","skull","slave",
    "sleep","slice","slide","slope","smart","smell","smile","smoke","snake","solar",
    "solid","solve","sorry","sound","south","space","spare","speak","speed","spend",
    "spent","spice","spine","spite","split","spoke","sport","spray","squad","stack",
    "staff","stage","stair","stake","stale","stall","stamp","stand","stark","start",
    "state","stays","steak","steam","steel","steep","steer","stick","stiff","still",
    "stock","stole","stone","stood","store","storm","story","stove","strip","stuck",
    "study","stuff","style","sugar","suite","sunny","super","surge","swamp","swear",
    "sweat","sweep","sweet","swept","swift","swing","sword","sworn","syrup","table",
    "taste","teach","teeth","tempt","thank","theft","theme","thick","thing","think",
    "third","thorn","those","three","threw","throw","thumb","tiger","tight","timer",
    "tired","title","today","token","topic","total","touch","tough","towel","tower",
    "toxic","trace","track","trade","trail","train","trait","trash","treat","trend",
    "trial","tribe","trick","tried","troop","truck","truly","trump","trunk","trust",
    "truth","tumor","twice","twist","ultra","uncle","under","union","unity","until",
    "upper","upset","urban","usage","usual","utter","valid","valor","value","valve",
    "vault","venue","verse","video","vigor","viral","virus","visit","vital","vivid",
    "vocal","vodka","voice","voter","wages","waste","watch","water","weave","wedge",
    "weigh","weird","whale","wheat","wheel","where","which","while","white","whole",
    "whose","wider","witch","woman","world","worry","worse","worst","worth","would",
    "wound","wrath","write","wrong","wrote","yacht","yield","young","youth","zebra"
];

const VALID_GUESSES_EXTRA = [
    "aahed","aalii","abaci","aback","abaft","abase","abash","abate","abbey","abbot",
    "abhor","abide","abler","abode","abort","about","abris","absit","acids","acmes",
    "acned","acorn","acres","acted","actin","added","adder","addle","adept","adieu",
    "adios","adlib","admin","admix","adobe","adobo","adore","adorn","admit","adopt",
    "afoot","afoul","again","agape","agate","agave","agent","aggro","agile","aging",
    "aglow","agone","agony","agree","ahold","aided","aider","aimed","aimer","aired",
    "aisle","alarm","album","alder","algae","alias","alibi","align","aline","allay",
    "allot","alloy","aloft","aloha","alpha","altar","altos","amass","amaze","amber",
    "amble","amino","amiss","amity","amour","ample","amply","amuse","angel","anger",
    "angle","angry","angst","anime","anise","ankle","annex","annoy","antic","anvil",
    "aorta","aphid","aping","apnea","apple","aptly","arbor","ardor","arena","argon",
    "argue","arise","armor","aroma","arose","ashen","ashes","askew","assay","asset",
    "atoll","atone","attic","audio","audit","augur","aunts","avail","avert","avian",
    "avids","avoid","await","awake","award","awash","awful","awing","axial","axing",
    "axiom","azure","babel","badge","badly","bagel","baggy","baker","balls","banal",
    "bands","bangs","banjo","banks","baron","barns","baron","basil","basin","basis",
    "batch","bathe","baton","beads","beady","beaks","beams","beans","bears","beast",
    "beats","beech","beefs","beefy","beers","began","begin","begun","being","belle",
    "bells","belly","below","belts","bench","bends","bergs","berry","bikes","bills",
    "binds","bingo","biome","birds","birth","bites","black","blade","blame","bland",
    "blank","blare","blast","blaze","bleak","bleat","bleed","blend","bless","blimp",
    "blind","bliss","blitz","bloat","blobs","block","bloke","blond","blood","bloom",
    "blown","blues","bluff","blunt","blurb","blurs","blurt","blush","board","boats",
    "bobby","bogey","bogus","bolts","bolus","bombs","bonds","boned","bones","bonus",
    "books","boost","booth","boots","booze","boozy","borne","bosom","bossy","botch",
    "bound","bowed","bowel","boxer","boxes","brace","braid","brain","brake","brand",
    "brash","brass","brave","bravo","brawl","brawn","bread","break","breed","brick",
    "bride","brief","brine","bring","brink","briny","brisk","broad","broil","broke",
    "brook","brood","broom","broth","brown","brush","brunt","build","built","bulge",
    "bulky","bully","bumps","bumpy","bunch","bunny","burns","burnt","burst","busts",
    "bushy","buyer","bylaw","bytes","cabal","cabin","cable","cache","cadet","caddy",
    "camel","cameo","canal","candy","canes","canoe","caper","cards","cared","carer",
    "cargo","carol","carry","carve","catch","cater","cause","cedar","chain","chair",
    "chalk","champ","chant","chaos","charm","chart","chase","cheap","cheat","check",
    "cheek","cheer","chess","chest","chick","chief","child","chill","china","chips",
    "choir","chord","chore","chose","chunk","churn","cider","cigar","cinch","cited",
    "civic","civil","claim","clamp","clams","clang","clank","claps","clash","clasp",
    "class","claws","clean","clear","clerk","click","cliff","climb","cling","clink",
    "clips","cloak","clock","clone","close","cloth","cloud","clown","clubs","cluck",
    "clued","clues","clump","clung","clunk","coach","coals","coast","cobra","cocoa",
    "coils","coins","colon","color","comet","comic","comma","condo","coral","cords",
    "corps","couch","cough","could","count","coupe","court","cover","crack","craft",
    "cramp","crane","crash","crate","crave","crawl","craze","crazy","creak","cream",
    "creep","crest","crews","crick","cried","crime","crisp","croak","cross","crowd",
    "crown","crude","cruel","crush","curds","cured","curly","curry","curse","curve",
    "cycle","daddy","daily","dairy","dance","dated","dates","dealt","death","debit",
    "debug","decal","decay","decks","decor","decoy","decry","deity","delay","delve",
    "demon","denim","dense","depot","depth","derby","detox","deuce","devil","diary",
    "digit","dimly","diner","dirty","disco","ditch","ditto","dizzy","docks","dodge",
    "doing","dolls","domes","donor","donut","donor","doubt","dough","douse","draft",
    "drain","drake","drama","drank","drape","drawl","drawn","draws","dread","dream",
    "dress","dried","drift","drill","drink","drive","droit","drone","drool","droop",
    "drops","dross","drove","drown","drums","drunk","dryer","dryly","ducks","duels",
    "duets","dummy","dumps","dunce","dunes","dunks","duped","dusty","dwarf","dying",
    "eager","eagle","early","earth","easel","eaten","eater","eclat","edges","edged",
    "edict","eight","eject","elbow","elder","elect","elite","elope","elude","elves",
    "email","ember","emcee","emits","empty","ended","endow","enemy","enjoy","enact",
    "enema","ensue","enter","entry","envoy","epoch","equal","equip","erase","erect",
    "erode","error","erupt","essay","ether","ethic","ethos","evade","event","every",
    "evict","evoke","exact","exalt","excel","exert","exile","exist","expat","expel",
    "extra","exude","exult","fable","faced","facet","fails","faint","fairy","faith",
    "faker","falls","false","famed","fancy","fangs","farce","farms","fatal","fatty",
    "fault","fauna","favor","feast","feats","feeds","feign","feint","fella","felon",
    "femur","fence","feral","ferry","fetch","fetid","fetus","feuds","fewer","fever",
    "fiber","fibre","field","fiend","fifth","fifty","fight","filmy","filth","final",
    "finch","finds","fined","finer","fires","firms","first","fishy","fixed","fixer",
    "fixes","fizzy","fjord","flags","flair","flake","flaky","flame","flank","flaps",
    "flare","flash","flask","flats","flaws","fleas","flesh","flick","flier","flies",
    "fling","flint","flips","float","flock","flood","floor","flora","floss","flour",
    "flout","flows","flubs","fluid","fluke","flung","flush","flute","foams","foamy",
    "focal","focus","foggy","foils","folds","folly","fonts","force","forge","forgo",
    "forks","forms","forte","forth","forum","fosse","found","foyer","frail","frame",
    "frank","fraud","frays","freak","freed","freer","fresh","friar","fried","fries",
    "frill","frisk","front","frost","frown","froze","fruit","fryer","fudge","fuels",
    "fully","fumes","funds","fungi","funny","furry","fused","fuses","fussy","fuzzy",
    "gaily","gains","games","gamma","gangs","gases","gauge","gaunt","gauze","gavel",
    "gazer","gears","genes","genie","genre","ghost","giant","gifts","giddy","gills",
    "given","giver","gives","gland","glare","glass","glaze","gleam","glean","glide",
    "glint","glitz","gloat","globe","gloom","glory","gloss","glove","glows","glued",
    "going","golem","goner","goose","gorge","grace","grade","graft","grail","grain",
    "grand","grant","grape","graph","grasp","grass","grate","grave","gravy","graze",
    "great","greed","green","greet","grief","grill","grime","grimy","grind","gripe",
    "grips","groan","groin","groom","grope","gross","group","grout","grove","growl",
    "grown","grows","gruel","grump","grunt","guard","guess","guest","guide","guild",
    "guilt","guise","gulch","gulls","gulps","gummy","gunky","guppy","gusts","gusty",
    "gypsy","haiku","hairs","hairy","hands","handy","hangs","happy","hardy","harem",
    "harms","harps","harsh","haste","hasty","hatch","hated","haven","havoc","hazel",
    "heads","heady","heals","heard","heart","heath","heave","heavy","hedge","heeds",
    "heels","hefty","heirs","heist","hello","hence","herbs","herds","hippo","hired",
    "hobby","holds","holes","holly","homes","honey","honor","hooks","hoped","horde",
    "horns","horse","hosts","hotel","hound","house","hover","howls","human","humid",
    "humor","humps","hurry","hydro","hyena","hyper","icily","icing","ideal","ideas",
    "idiot","idled","image","imago","imbue","impel","imply","inane","incur","index",
    "indie","inept","inert","infer","ingot","inked","inlet","inner","input","inter",
    "intro","ionic","irate","irony","issue","itchy","items","ivory","jacks","jaded",
    "jaunt","jazzy","jeans","jelly","jerks","jerky","jewel","jiffy","jiggy","jimmy",
    "joins","joint","joker","jolly","joust","judge","juice","juicy","jumbo","jumps",
    "jumpy","juror","karma","kayak","kazoo","kebab","keeps","keyed","khaki","kicks",
    "kills","kinds","kings","kiosk","knack","knead","kneel","knelt","knife","knobs",
    "knock","knoll","knots","known","knows","koala","kudos","label","labor","laced",
    "lacks","laden","ladle","lager","lakes","lambs","lamps","lands","lanes","lapse",
    "large","larva","laser","lasts","latch","later","latex","lathe","laugh","layer",
    "leads","leafy","leaks","leaky","leaps","leapt","learn","lease","least","leave",
    "ledge","legal","lemon","level","lever","light","liked","limbo","limes","limit",
    "limps","lined","linen","liner","lines","links","lions","lists","liter","liver",
    "lived","lives","llama","loads","loafs","loams","loamy","loans","lobby","local",
    "locks","lodge","lofty","logic","login","logos","looks","loops","loose","lords",
    "lorry","loses","lossy","lousy","loved","lover","lower","loyal","lucid","lucky",
    "lumen","lumps","lumpy","lunch","lunge","lungs","lurch","lured","lurks","lusty",
    "lying","lyric","macho","macro","madly","magic","magma","manor","maple","march",
    "marks","marsh","masks","mason","match","mates","mayor","meals","mealy","means",
    "meats","meaty","medal","media","meets","melee","melon","mercy","merge","merit",
    "merry","messy","metal","meter","midst","might","milks","milky","mills","mimic",
    "minds","mined","miner","mines","minor","minus","mirth","miser","misty","mixer",
    "moans","moats","model","modem","modes","mogul","moist","molar","molds","moldy",
    "money","monks","month","moods","moody","moose","moral","morph","motor","motto",
    "mound","mount","mourn","mouse","mouth","moved","mover","moves","movie","mowed",
    "mucus","muddy","muffs","mulch","mules","multi","mumps","mural","murky","music",
    "musty","naive","named","nanny","nasal","nasty","naval","navel","necks","needs",
    "nerve","nervy","never","newer","newly","nexus","nicer","niche","night","ninja",
    "noble","nobly","noise","noisy","nonce","nooks","norms","north","notch","noted",
    "notes","novel","nudge","nurse","nutty","nylon","oaken","oasis","occur","ocean",
    "oddly","odors","offer","often","oiled","olden","older","olive","omega","onset",
    "oomph","opens","opera","opted","optic","orbit","order","organ","other","otter",
    "ought","ounce","outer","outdo","outre","ovals","ovens","overt","owned","owner",
    "oxide","ozone","paced","packs","paddy","pagan","pages","pains","paint","pairs",
    "palms","panda","panel","panes","panic","pansy","pants","paper","papal","parts",
    "party","pasta","paste","patch","paths","patio","pause","paved","paver","peace",
    "peach","peaks","pearl","pears","pecan","pedal","penny","perch","peril","perks",
    "perky","pesky","pests","petal","petty","phase","phone","photo","piano","picks",
    "picky","piece","piers","piggy","piled","pills","pilot","pinch","pines","pinky",
    "pints","pious","pipes","pitch","pivot","pixel","pixie","pizza","place","plaid",
    "plain","plane","plank","plans","plant","plate","plays","plaza","plead","pleas",
    "pleat","plied","plier","plods","plots","ploys","pluck","plugs","plumb","plume",
    "plump","plums","plums","plunk","plush","plyer","poach","poems","poets","point",
    "poise","poker","polar","poles","ponds","pools","poppy","porch","pores","ports",
    "posed","poses","posse","posts","pouch","pound","power","prank","prawn","prays",
    "press","price","prick","pride","pries","prime","print","prism","privy","prize",
    "probe","prods","prone","prong","proof","prose","proud","prove","prude","prune",
    "psalm","pulls","pulps","pulse","pumps","punch","punks","pupil","puppy","purge",
    "purse","pushy","putty","pygmy","quack","quail","quake","qualm","queen","query",
    "quest","queue","quick","quiet","quill","quirk","quota","quote","rabbi","radar",
    "radio","radon","raids","rails","rains","rainy","raise","rally","ramps","ranch",
    "range","ranks","rapid","raven","razor","reach","react","reads","ready","realm",
    "reams","reaps","rebel","rebus","recap","recon","recto","recut","reeds","reedy",
    "reefs","reeks","refit","regal","reign","reins","relax","relay","relic","remit",
    "renal","renew","repay","repel","reply","reset","resin","retro","retry","reuse",
    "revel","rider","ridge","rifle","right","rigid","rigor","rinds","rings","rinse",
    "riots","ripen","risen","riser","rises","risky","ritzy","rival","river","roads",
    "roams","roars","roast","robes","robin","robot","rocks","rocky","rodeo","rogue",
    "roles","rolls","roman","roofs","rooms","roomy","roots","ropes","roses","rotor",
    "rouge","rough","round","route","rover","royal","rugby","ruins","ruled","ruler",
    "rules","rumba","rumor","rural","rusty","saber","sadly","sagas","saint","salad",
    "sales","salon","salsa","salty","salve","salvo","sands","sandy","sauce","saucy",
    "sauna","saved","savor","scale","scalp","scald","scams","scant","scare","scarf",
    "scary","scene","scent","score","scold","scone","scoop","scope","scorn","scout",
    "scowl","scram","scrap","screw","scrub","seals","seams","seats","sedan","seeds",
    "seedy","seeks","seems","seize","sense","serum","serve","seven","sever","shade",
    "shady","shaft","shake","shaky","shall","shame","shape","shard","share","shark",
    "sharp","shave","shawl","shear","sheds","sheen","sheep","sheer","sheet","shelf",
    "shell","shift","shims","shine","shiny","ships","shire","shirt","shock","shoes",
    "shone","shook","shoot","shops","shore","shorn","short","shots","shout","shove",
    "shown","shows","shrew","shrub","shrug","shuck","shunt","sight","sigma","signs",
    "silly","silks","silky","since","siren","sissy","sixty","sized","sizes","skate",
    "skein","skies","skill","skimp","skins","skips","skirt","skull","skunk","slabs",
    "slack","slain","slang","slant","slaps","slash","slate","slave","sleek","sleep",
    "sleet","slept","slice","slide","slime","slimy","sling","slink","slips","slope",
    "slosh","sloth","slugs","slump","slums","slung","slunk","slurp","smack","small",
    "smart","smash","smear","smell","smelt","smile","smirk","smite","smith","smoke",
    "snack","snags","snail","snake","snaps","snare","snarl","sneak","sneer","snide",
    "sniff","snore","snort","snout","snowy","snuck","snuff","soaps","soapy","soars",
    "sober","socks","sofas","soggy","soils","solar","solid","solve","sonic","sorry",
    "sorts","souls","sound","south","space","spade","spans","spare","spark","spawn",
    "speak","spear","speck","specs","speed","spell","spend","spent","spice","spicy",
    "spied","spiel","spike","spill","spine","spoke","spoon","sport","spots","spout",
    "spray","spree","sprig","spunk","spurn","squad","squat","squid","stack","staff",
    "stage","stags","staid","stain","stair","stake","stale","stalk","stall","stamp",
    "stand","stank","stare","stark","stars","start","stash","state","stays","steak",
    "steal","steam","steel","steep","steer","stems","steps","stern","stews","stick",
    "stiff","still","stilt","sting","stink","stint","stock","stoic","stoke","stole",
    "stomp","stone","stood","stool","stoop","stops","store","stork","storm","story",
    "stout","stove","strap","straw","stray","strip","strut","stuck","study","stuff",
    "stump","stung","stunk","stunt","style","suave","sugar","suite","suits","sulky",
    "sunny","super","surge","sushi","swamp","swans","swaps","swarm","swath","swear",
    "sweat","sweep","sweet","swell","swept","swift","swill","swine","swing","swipe",
    "swirl","swish","swoop","sword","swore","sworn","swung","syrup","tabby","table",
    "tacit","tacos","taint","taken","taker","tales","talks","tally","talon","tamed",
    "tango","tanks","taped","taper","tapes","tardy","taste","tasty","taunt","taxes",
    "teach","teams","tears","teary","tease","teeth","tempo","tends","tenor","tense",
    "tenth","tepid","terms","terry","tests","thank","theft","theme","thick","thief",
    "thigh","thing","think","third","thorn","those","three","threw","throw","thuds",
    "thugs","thumb","thump","tiara","tidal","tides","tiger","tight","tiled","tiles",
    "tilts","timer","times","timid","tints","tipsy","tired","titan","title","toast",
    "today","token","tolls","tombs","tonal","toned","tongs","tonic","tools","tooth",
    "topic","torch","total","totem","touch","tough","tours","towel","tower","towns",
    "toxic","trace","track","tract","trade","trail","train","trait","tramp","trash",
    "trawl","treat","trees","trend","trial","tribe","trick","tried","tries","trims",
    "trite","troll","troop","trots","trout","truce","truck","truly","trump","trunk",
    "truss","trust","truth","tulip","tumor","tunes","tunic","turns","tutor","twang",
    "tweed","tweet","twice","twigs","twine","twirl","twist","tying","udder","ulcer",
    "ultra","umbra","uncle","under","undid","undue","unfit","unify","union","unite",
    "units","unity","unlit","until","unwed","upper","upset","urban","urged","usage",
    "usher","using","usual","usurp","utter","vague","valid","valor","value","valve",
    "vapor","vault","veins","veldt","venue","verge","verse","vigor","vinyl","viola",
    "viper","viral","virus","visor","visit","vista","vital","vivid","vixen","vocal",
    "vodka","vogue","voice","voter","vouch","vowel","vying","wacky","waded","wager",
    "wages","wagon","waist","walks","walls","waltz","wands","wants","wards","warns",
    "warps","waste","watch","water","watts","waved","waves","waxed","weary","weave",
    "wedge","weeds","weedy","weeks","weigh","weird","wells","whale","wheat","wheel",
    "where","which","while","whine","whiny","whips","whirl","whisk","white","whole",
    "whose","widen","wider","widow","width","wield","winds","windy","wines","wings",
    "wiped","wiper","wired","wires","witch","wives","woken","woman","women","woods",
    "woody","words","wordy","works","world","worms","wormy","worry","worse","worst",
    "worth","would","wound","wrath","wreak","wreck","wring","wrist","wrote","yacht",
    "yards","yarns","yearn","years","yeast","yield","young","yours","youth","zebra",
    "zeros","zesty","zilch","zonal","zones"
];

// Build full valid guess set (answers + extra guesses)
const ALL_VALID = new Set([...ANSWER_WORDS, ...VALID_GUESSES_EXTRA].map(w => w.toLowerCase()));

// ===== Audio System =====
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.08;

        switch (type) {
            case 'key':
                osc.type = 'sine';
                osc.frequency.value = 600;
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
                break;
            case 'flip':
                osc.type = 'triangle';
                osc.frequency.value = 400;
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.15);
                break;
            case 'correct':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, ctx.currentTime);
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
                break;
            case 'wrong':
                osc.type = 'sawtooth';
                osc.frequency.value = 200;
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
                break;
        }
    } catch (e) { /* audio not supported */ }
}

// ===== Game State =====
const NUM_ROWS = 6;
const NUM_COLS = 5;
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let targetWord = '';
let guesses = [];
let letterStates = {}; // letter -> 'correct' | 'present' | 'absent'
let gameMode = 'daily'; // 'daily' | 'random'

// ===== Stats =====
function loadStats() {
    try {
        const raw = localStorage.getItem('wordle_stats');
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
        played: 0,
        won: 0,
        currentStreak: 0,
        maxStreak: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        lastDate: null
    };
}

function saveStats(stats) {
    try { localStorage.setItem('wordle_stats', JSON.stringify(stats)); } catch (e) {}
}

let stats = loadStats();

// ===== Daily Word Logic =====
function getDayIndex() {
    const epoch = new Date(2024, 0, 1); // Jan 1, 2024
    const now = new Date();
    const diff = now.getTime() - epoch.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function getDailyWord() {
    const dayIdx = getDayIndex();
    const rng = seededRandom(dayIdx + 42);
    const idx = Math.floor(rng() * ANSWER_WORDS.length);
    return ANSWER_WORDS[idx].toLowerCase();
}

function getRandomWord() {
    const idx = Math.floor(Math.random() * ANSWER_WORDS.length);
    return ANSWER_WORDS[idx].toLowerCase();
}

// ===== DOM Setup =====
const boardEl = document.getElementById('board');
const kbEl = document.getElementById('keyboard');

function createBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < NUM_ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.id = 'row-' + r;
        for (let c = 0; c < NUM_COLS; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = 'tile-' + r + '-' + c;
            tile.innerHTML = '<div class="tile-inner"><div class="tile-front"></div><div class="tile-back"></div></div>';
            row.appendChild(tile);
        }
        boardEl.appendChild(row);
    }
}

// ===== Toast =====
function showToast(msg, duration = 1500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ===== Input Handling =====
let isRevealing = false; // lock to prevent input during reveal animation

function handleKey(key) {
    if (gameOver || isRevealing) return;

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE') {
        deleteLetter();
    } else if (/^[A-Z]$/.test(key)) {
        addLetter(key);
    }
}

function addLetter(letter) {
    if (currentCol >= NUM_COLS) return;
    const tile = document.getElementById('tile-' + currentRow + '-' + currentCol);
    const front = tile.querySelector('.tile-front');
    front.textContent = letter;
    tile.classList.add('filled');
    playSound('key');
    currentCol++;
}

function deleteLetter() {
    if (currentCol <= 0) return;
    currentCol--;
    const tile = document.getElementById('tile-' + currentRow + '-' + currentCol);
    const front = tile.querySelector('.tile-front');
    front.textContent = '';
    tile.classList.remove('filled');
}

function getCurrentWord() {
    let word = '';
    for (let c = 0; c < NUM_COLS; c++) {
        const tile = document.getElementById('tile-' + currentRow + '-' + c);
        const front = tile.querySelector('.tile-front');
        word += front.textContent;
    }
    return word.toLowerCase();
}

function submitGuess() {
    if (currentCol < NUM_COLS) {
        shakeRow(currentRow);
        showToast('Not enough letters');
        return;
    }

    const guess = getCurrentWord();

    if (!ALL_VALID.has(guess)) {
        shakeRow(currentRow);
        showToast('Not in word list');
        playSound('wrong');
        return;
    }

    const result = evaluateGuess(guess, targetWord);
    guesses.push({ word: guess, result });
    isRevealing = true;

    revealRow(currentRow, result, () => {
        isRevealing = false;
        updateKeyboard(guess, result);

        const won = result.every(r => r === 'correct');
        if (won) {
            gameOver = true;
            playSound('correct');
            const messages = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
            showToast(messages[currentRow] || 'Nice!');
            bounceRow(currentRow);
            recordResult(true, currentRow + 1);
            setTimeout(() => showStats(currentRow + 1), 2200);
        } else if (currentRow >= NUM_ROWS - 1) {
            gameOver = true;
            playSound('wrong');
            showToast(targetWord.toUpperCase(), 3000);
            recordResult(false, 0);
            setTimeout(() => showStats(null), 2200);
        }

        currentRow++;
        currentCol = 0;
    });
}

function evaluateGuess(guess, target) {
    const result = Array(NUM_COLS).fill('absent');
    const targetArr = target.split('');
    const guessArr = guess.split('');
    const used = Array(NUM_COLS).fill(false);

    // Green pass
    for (let i = 0; i < NUM_COLS; i++) {
        if (guessArr[i] === targetArr[i]) {
            result[i] = 'correct';
            used[i] = true;
            guessArr[i] = null;
        }
    }

    // Yellow pass
    for (let i = 0; i < NUM_COLS; i++) {
        if (guessArr[i] === null) continue;
        for (let j = 0; j < NUM_COLS; j++) {
            if (!used[j] && guessArr[i] === targetArr[j]) {
                result[i] = 'present';
                used[j] = true;
                break;
            }
        }
    }

    return result;
}

function revealRow(row, result, callback) {
    const tiles = [];
    for (let c = 0; c < NUM_COLS; c++) {
        tiles.push(document.getElementById('tile-' + row + '-' + c));
    }

    tiles.forEach((tile, i) => {
        setTimeout(() => {
            const back = tile.querySelector('.tile-back');
            back.textContent = tile.querySelector('.tile-front').textContent;
            tile.classList.add('revealed', result[i]);
            playSound('flip');
        }, i * 300);
    });

    setTimeout(() => {
        if (callback) callback();
    }, NUM_COLS * 300 + 400);
}

function updateKeyboard(guess, result) {
    const priority = { 'correct': 3, 'present': 2, 'absent': 1 };

    for (let i = 0; i < NUM_COLS; i++) {
        const letter = guess[i].toUpperCase();
        const state = result[i];
        const current = letterStates[letter];
        if (!current || priority[state] > priority[current]) {
            letterStates[letter] = state;
        }
    }

    // Update keyboard buttons
    const buttons = kbEl.querySelectorAll('button[data-key]');
    buttons.forEach(btn => {
        const key = btn.getAttribute('data-key');
        if (letterStates[key]) {
            btn.className = btn.className.replace(/\b(correct|present|absent)\b/g, '').trim();
            btn.classList.add(letterStates[key]);
            if (btn.classList.contains('kb-wide')) btn.classList.add('kb-wide');
        }
    });
}

function shakeRow(row) {
    const rowEl = document.getElementById('row-' + row);
    rowEl.classList.add('shake');
    setTimeout(() => rowEl.classList.remove('shake'), 600);
}

function bounceRow(row) {
    for (let c = 0; c < NUM_COLS; c++) {
        const tile = document.getElementById('tile-' + row + '-' + c);
        setTimeout(() => tile.classList.add('bounce'), c * 100 + 1600);
    }
}

// ===== Stats & Recording =====
function recordResult(won, attempts) {
    stats.played++;
    if (won) {
        stats.won++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
        stats.distribution[attempts] = (stats.distribution[attempts] || 0) + 1;
    } else {
        stats.currentStreak = 0;
    }
    if (gameMode === 'daily') {
        stats.lastDate = new Date().toDateString();
    }
    saveStats(stats);

    // Platform integration
    if (window.GamePlatform) {
        GamePlatform.recordGame('wordle', won ? attempts : 0, 0, { win: won });
    }
}

function showStats(winRow) {
    const overlay = document.getElementById('stats-overlay');
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-win-pct').textContent = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    document.getElementById('stat-streak').textContent = stats.currentStreak;
    document.getElementById('stat-max-streak').textContent = stats.maxStreak;

    // Distribution
    const distEl = document.getElementById('guess-distribution');
    distEl.innerHTML = '';
    const maxDist = Math.max(1, ...Object.values(stats.distribution));

    for (let i = 1; i <= 6; i++) {
        const val = stats.distribution[i] || 0;
        const pct = Math.max(8, (val / maxDist) * 100);
        const row = document.createElement('div');
        row.className = 'dist-row';
        const isHighlight = winRow === i;
        row.innerHTML = `<span class="dist-label">${i}</span><div class="dist-bar${isHighlight ? ' highlight' : ''}" style="width:${pct}%">${val}</div>`;
        distEl.appendChild(row);
    }

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (gameOver) {
        shareBtn.classList.remove('hidden');
    } else {
        shareBtn.classList.add('hidden');
    }

    overlay.classList.remove('hidden');
}

function generateShareText() {
    const dayStr = gameMode === 'daily' ? getDayIndex() : '?';
    const won = guesses.length <= NUM_ROWS && guesses[guesses.length - 1].result.every(r => r === 'correct');
    const attempts = won ? guesses.length : 'X';
    let text = `Wordle ${dayStr} ${attempts}/${NUM_ROWS}\n\n`;

    guesses.forEach(g => {
        const line = g.result.map(r => {
            if (r === 'correct') return '🟩';
            if (r === 'present') return '🟨';
            return '⬛';
        }).join('');
        text += line + '\n';
    });

    text += '\nmnciitbhu.me/games/wordle/';
    return text;
}

// ===== Game Initialization =====
function initGame() {
    currentRow = 0;
    currentCol = 0;
    gameOver = false;
    isRevealing = false;
    guesses = [];
    letterStates = {};
    createBoard();

    // Reset keyboard colors
    const buttons = kbEl.querySelectorAll('button[data-key]');
    buttons.forEach(btn => {
        btn.classList.remove('correct', 'present', 'absent');
    });

    if (gameMode === 'daily') {
        targetWord = getDailyWord();
    } else {
        targetWord = getRandomWord();
    }
}

// ===== Event Listeners =====

// Physical keyboard
document.addEventListener('keydown', (e) => {
    if (document.querySelector('.overlay:not(.hidden)')) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        handleKey('ENTER');
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toUpperCase());
    }
});

// On-screen keyboard — use pointerup for unified touch/mouse handling
// This prevents duplicate events from touchend+click
kbEl.addEventListener('pointerup', (e) => {
    if (document.querySelector('.overlay:not(.hidden)')) return;
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    e.preventDefault();
    handleKey(btn.getAttribute('data-key'));
});

// Mode toggle
document.getElementById('mode-daily').addEventListener('click', () => {
    if (gameMode === 'daily') return;
    gameMode = 'daily';
    document.getElementById('mode-daily').classList.add('active');
    document.getElementById('mode-random').classList.remove('active');
    initGame();
});

document.getElementById('mode-random').addEventListener('click', () => {
    if (gameMode === 'random' && !gameOver) return;
    gameMode = 'random';
    document.getElementById('mode-random').classList.add('active');
    document.getElementById('mode-daily').classList.remove('active');
    initGame();
});

// How to play
document.getElementById('how-to-play-close').addEventListener('click', () => {
    document.getElementById('how-to-play-overlay').classList.add('hidden');
});

document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('how-to-play-overlay').classList.remove('hidden');
});

// Stats
document.getElementById('stats-btn').addEventListener('click', () => {
    showStats(null);
});

document.getElementById('stats-close').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.add('hidden');
});

// Close overlays on background click
document.getElementById('stats-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('stats-overlay').classList.add('hidden');
    }
});

document.getElementById('how-to-play-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('how-to-play-overlay').classList.add('hidden');
    }
});

// Share button
document.getElementById('share-btn').addEventListener('click', () => {
    const text = generateShareText();
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('share-toast');
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }).catch(() => {
        showToast('Failed to copy');
    });
});

// Check if user already played daily today
function checkDailyPlayed() {
    if (gameMode === 'daily' && stats.lastDate === new Date().toDateString()) {
        // Already played today - still allow but show stats
    }
}

// ===== Start =====
initGame();
checkDailyPlayed();

// Show how-to-play on first visit
if (!localStorage.getItem('wordle_visited')) {
    localStorage.setItem('wordle_visited', '1');
} else {
    document.getElementById('how-to-play-overlay').classList.add('hidden');
}

// Platform integration
if (window.GamePlatform) {
    GamePlatform.initHeader('Wordle');
}
