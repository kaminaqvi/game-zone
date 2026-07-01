const easy = [
  'cat', 'dog', 'sun', 'run', 'hop', 'bat', 'hat', 'map', 'ant', 'bug',
  'cup', 'egg', 'fan', 'fog', 'hug', 'jam', 'kit', 'log', 'mud', 'net',
  'pan', 'rat', 'sit', 'top', 'web', 'bed', 'can', 'dig', 'fit', 'hit',
  'kid', 'lip', 'nap', 'rub', 'sip', 'tan', 'win', 'box', 'cap', 'den',
  'fig', 'hem', 'jaw', 'frog', 'duck', 'fish', 'bird', 'worm', 'crab', 'deer',
  'cow', 'pig', 'hen', 'bee', 'fly', 'owl', 'fox', 'ram', 'yak', 'emu',
  'arm', 'ear', 'eye', 'leg', 'rib', 'toe', 'hay', 'oak', 'ivy', 'elm',
  'red', 'big', 'hot', 'wet', 'dry', 'old', 'new', 'far', 'low', 'raw'
];

const medium = [
  'tiger', 'dragon', 'castle', 'monkey', 'jungle', 'planet', 'rocket', 'wizard',
  'garden', 'bridge', 'candle', 'dancer', 'engine', 'flower', 'goblin', 'hunter',
  'insect', 'kitten', 'locket', 'muffin', 'nugget', 'oyster', 'puffin', 'rabbit',
  'salmon', 'turtle', 'walrus', 'anchor', 'bubble', 'cactus', 'donkey', 'fudge',
  'giraffe', 'hamster', 'igloo', 'jacket', 'kettle', 'lemon', 'mango', 'ninja',
  'otter', 'parrot', 'puzzle', 'robot', 'spider', 'trophy', 'umbrella', 'velvet',
  'wizard', 'yogurt', 'zipper', 'banana', 'cherry', 'cookie', 'donut', 'eclair',
  'forest', 'galaxy', 'helmet', 'island', 'jigsaw', 'ketchup', 'lollipop', 'marble',
  'noodle', 'orange', 'pillow', 'quiver', 'radish', 'silver', 'ticket', 'unzip',
  'violin', 'window', 'xyloph', 'yellow', 'zombie', 'panda', 'koala', 'llama'
];

const hard = [
  'dinosaur', 'elephant', 'adventure', 'chocolate', 'butterfly', 'champion',
  'discover', 'energetic', 'fantastic', 'geography', 'happiness', 'invention',
  'jellyfish', 'knowledge', 'lightning', 'magnetic', 'nighttime', 'orchestra',
  'porcupine', 'raspberry', 'superhero', 'telescope', 'universal', 'waterfall',
  'xylophone', 'zoologist', 'blizzard', 'calendar', 'dangerous', 'education',
  'ferocious', 'glamorous', 'hurricane', 'important', 'kangaroo', 'labyrinth',
  'mysterious', 'nightmare', 'operation', 'passenger', 'rhinoceros', 'satellite',
  'terrific', 'vacation', 'wonderful', 'excellent', 'beautiful', 'dangerous',
  'celebrate', 'enormous', 'flamingo', 'gigantic', 'hibernat', 'imaginary',
  'juvenile', 'kindness', 'language', 'momentum', 'navigate', 'obstacle',
  'paradise', 'question', 'reaction', 'surprise', 'treasure', 'universe',
  'villager', 'wanderer', 'explorer', 'yearbook', 'absolute', 'backbone'
];

const paragraphs = {
  easy: [
    'The big dog ran down the old dirt path. He saw a cat and barked at it. The cat climbed up a tall oak tree and hid in the leaves.',
    'A small frog sat on a wet log by the pond. It saw a fly buzz past and jumped to catch it. Then it dove into the cool blue water.',
    'The sun rose over the green hill one morning. Two kids ran out to play in the soft grass. They found a worm and put it in a cup.',
    'Mom made a big pot of hot soup for lunch. The whole house smelled warm and nice. Dad and the kids sat down and said it was the best soup ever.',
    'The little bird built a nest high in the pine tree. She laid three blue eggs in it. Every day she sat on the nest to keep the eggs warm and safe.',
    'Tim got a new red bike for his birthday. He rode it up and down the street all day long. His dog ran next to him and barked with joy.',
  ],
  medium: [
    'The young explorer packed her compass and a warm jacket before heading into the forest. She followed the winding trail until she reached a hidden waterfall. The sight took her breath away and she sat quietly listening to the rushing sound of the water.',
    'Every Saturday morning the baker woke before sunrise to prepare fresh loaves of golden bread. The warm smell drifted through the village streets, bringing neighbors to the bakery door. Everyone agreed his cinnamon rolls were the finest treat for miles around.',
    'The astronaut floated gently inside the space station, watching Earth turn slowly far below. Clouds swirled over the blue oceans like slow-moving paint. She pressed her hand against the cold window and felt grateful to be one of the few people who had seen this view.',
    'The library was quiet except for the soft turning of pages and the hum of the old heater in the corner. Marcus found a thick book about ancient Egypt and sat at a wooden table to read. Hours passed before he even noticed the time.',
    'A sudden summer storm rolled over the valley, turning the sky a deep shade of purple and grey. Lightning flashed in the distance while thunder shook the windows of the farmhouse. The horses gathered under the big oak tree at the edge of the field.',
    'The lighthouse keeper climbed the spiral staircase each evening to light the great lantern at the top. Ships far out at sea used that steady beam to navigate safely around the dangerous rocks. She had kept the light burning for more than twenty years without missing a single night.',
  ],
  hard: [
    'The ancient observatory perched on the highest hill had tracked the movements of stars and planets for nearly three hundred years. Scientists arrived every autumn to calibrate the enormous brass telescope and record their observations in leather-bound journals. This particular evening promised a rare conjunction of Jupiter and Saturn, visible to the naked eye for the first time since the seventeenth century.',
    'Archaeologists carefully brushed sand from the surface of a ceramic vessel buried beneath the ruins of a marketplace dating back two thousand years. The inscription along the rim suggested it had been used to store olive oil traded across the Mediterranean. Such discoveries reminded the team why they had devoted their careers to uncovering the daily lives of ordinary people from antiquity.',
    'The young composer sat at the piano late into the evening, searching for a melody that captured both the sadness of departure and the quiet anticipation of a new beginning. Notes scattered across the manuscript paper like footprints in snow. When she finally played the complete passage, her teacher closed his eyes and nodded slowly in silent recognition of something extraordinary.',
    'Beneath the canopy of the rainforest, an astonishing variety of organisms competed for sunlight, nutrients, and survival in what ecologists described as one of the most complex ecosystems on the planet. Researchers catalogued hundreds of previously undocumented species each expedition, reinforcing the urgent argument for conservation before deforestation permanently erased these biological libraries forever.',
    'The lighthouse keeper had maintained the same routine for thirty-seven years without interruption, climbing the iron spiral staircase each dusk to ignite the lantern and descending at dawn to record wind speeds and visibility in a weathered logbook. Sailors navigating the treacherous rocky coastline had never needed to think about the invisible hand guiding them safely past the hidden reefs.',
    'Quantum computing represents a fundamental departure from the binary logic that has governed electronic calculation since the mid-twentieth century. Rather than storing information as discrete zeros and ones, quantum processors exploit the principles of superposition and entanglement to evaluate an enormous number of possible solutions simultaneously. Researchers expect this shift to transform fields ranging from pharmaceutical discovery to cryptographic security within the coming decades.',
  ],
};

module.exports = { easy, medium, hard, paragraphs };
