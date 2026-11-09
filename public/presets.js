// Built-in boards for the host's board builder.
const PRESETS = {
  easy: {
    categories: [
      {
        name: 'Animals',
        questions: [
          { clue: 'The largest land animal on Earth', answer: 'What is an elephant?' },
          { clue: 'This black and white bear eats bamboo', answer: 'What is a panda?' },
          { clue: 'The fastest land animal', answer: 'What is a cheetah?' },
          { clue: 'The only mammal capable of true flight', answer: 'What is a bat?' },
          { clue: 'A group of lions is called this', answer: 'What is a pride?' },
        ]
      },
      {
        name: 'Geography',
        questions: [
          { clue: 'The capital of France', answer: 'What is Paris?' },
          { clue: 'The longest river in the world', answer: 'What is the Nile?' },
          { clue: 'The smallest country in the world', answer: 'What is Vatican City?' },
          { clue: 'The continent with the most countries', answer: 'What is Africa?' },
          { clue: 'The ocean between Europe and North America', answer: 'What is the Atlantic?' },
        ]
      },
      {
        name: 'Pop Culture',
        questions: [
          { clue: 'The wizard school Harry Potter attends', answer: 'What is Hogwarts?' },
          { clue: 'The king of the jungle', answer: 'What is a lion?' },
          { clue: 'Mickey Mouse\'s girlfriend', answer: 'Who is Minnie Mouse?' },
          { clue: 'The sport played at Wimbledon', answer: 'What is tennis?' },
          { clue: 'This superhero is also known as the Dark Knight', answer: 'Who is Batman?' },
        ]
      },
      {
        name: 'Food & Drink',
        questions: [
          { clue: 'The main ingredient in guacamole', answer: 'What is avocado?' },
          { clue: 'This Italian dish is made with flat dough and toppings', answer: 'What is pizza?' },
          { clue: 'The country that invented sushi', answer: 'What is Japan?' },
          { clue: 'This yellow fruit is high in potassium', answer: 'What is a banana?' },
          { clue: 'A hot drink made from roasted beans', answer: 'What is coffee?' },
        ]
      },
      {
        name: 'Sports',
        questions: [
          { clue: 'The number of players on a basketball team on the court', answer: 'What is 5?' },
          { clue: 'The sport where you score a "hole in one"', answer: 'What is golf?' },
          { clue: 'The city that hosts the Masters golf tournament', answer: 'What is Augusta?' },
          { clue: 'The most goals scored in a World Cup final', answer: 'What is 5?' },
          { clue: 'Michael Jordan\'s jersey number with the Bulls', answer: 'What is 23?' },
        ]
      },
      {
        name: 'Famous Firsts',
        questions: [
          { clue: 'The first President of the United States', answer: 'Who is George Washington?' },
          { clue: 'The first country to give women the right to vote', answer: 'What is New Zealand?' },
          { clue: 'The first man to walk on the moon', answer: 'Who is Neil Armstrong?' },
          { clue: 'The first feature-length animated Disney film', answer: 'What is Snow White?' },
          { clue: 'The first iPhone was released in this year', answer: 'What is 2007?' },
        ]
      },
    ]
  },
  medium: {
    categories: [
      {
        name: 'History',
        questions: [
          { clue: 'The year World War II ended', answer: 'What is 1945?' },
          { clue: 'The ancient wonder located in Egypt', answer: 'What are the Pyramids of Giza?' },
          { clue: 'The empire Julius Caesar led', answer: 'What is the Roman Empire?' },
          { clue: 'The document signed at Runnymede in 1215', answer: 'What is the Magna Carta?' },
          { clue: 'This wall divided East and West Berlin', answer: 'What is the Berlin Wall?' },
        ]
      },
      {
        name: 'Science',
        questions: [
          { clue: 'The chemical symbol for gold', answer: 'What is Au?' },
          { clue: 'The speed of light in a vacuum (approx. km/s)', answer: 'What is 300,000 km/s?' },
          { clue: 'The force that keeps planets in orbit', answer: 'What is gravity?' },
          { clue: 'DNA stands for this', answer: 'What is Deoxyribonucleic Acid?' },
          { clue: 'The atomic number of carbon', answer: 'What is 6?' },
        ]
      },
      {
        name: 'Literature',
        questions: [
          { clue: 'The author of "1984" and "Animal Farm"', answer: 'Who is George Orwell?' },
          { clue: 'The whale in Moby-Dick', answer: 'What is a sperm whale?' },
          { clue: 'Shakespeare\'s play about the Prince of Denmark', answer: 'What is Hamlet?' },
          { clue: 'The fictional detective who lived at 221B Baker Street', answer: 'Who is Sherlock Holmes?' },
          { clue: 'The author of "Pride and Prejudice"', answer: 'Who is Jane Austen?' },
        ]
      },
      {
        name: 'Music',
        questions: [
          { clue: 'The "King of Pop"', answer: 'Who is Michael Jackson?' },
          { clue: 'Beethoven\'s famous symphony written while deaf', answer: 'What is the 9th Symphony?' },
          { clue: 'The Beatles were from this city', answer: 'What is Liverpool?' },
          { clue: 'This instrument has 88 keys', answer: 'What is a piano?' },
          { clue: 'The genre that combines jazz and rock', answer: 'What is fusion?' },
        ]
      },
      {
        name: 'Movies',
        questions: [
          { clue: 'The director of Pulp Fiction', answer: 'Who is Quentin Tarantino?' },
          { clue: 'The highest-grossing film of all time (adjusted)', answer: 'What is Gone With the Wind?' },
          { clue: '"I\'ll be back" is a line from this film', answer: 'What is The Terminator?' },
          { clue: 'The first film to win the Oscar for Best Picture', answer: 'What is Wings?' },
          { clue: 'Pixar\'s first feature film', answer: 'What is Toy Story?' },
        ]
      },
      {
        name: 'Famous People',
        questions: [
          { clue: 'The scientist who developed the theory of relativity', answer: 'Who is Albert Einstein?' },
          { clue: 'The first woman to win a Nobel Prize', answer: 'Who is Marie Curie?' },
          { clue: 'The painter of the Sistine Chapel ceiling', answer: 'Who is Michelangelo?' },
          { clue: 'The civil rights leader known for the "I Have a Dream" speech', answer: 'Who is Martin Luther King Jr.?' },
          { clue: 'The founder of Microsoft', answer: 'Who is Bill Gates?' },
        ]
      },
    ]
  },
  hard: {
    categories: [
      {
        name: 'World History',
        questions: [
          { clue: 'The Byzantine Empire fell to this empire in 1453', answer: 'What is the Ottoman Empire?' },
          { clue: 'The treaty that ended World War I', answer: 'What is the Treaty of Versailles?' },
          { clue: 'The only US President to resign from office', answer: 'Who is Richard Nixon?' },
          { clue: 'The year the French Revolution began', answer: 'What is 1789?' },
          { clue: 'This philosopher wrote "The Republic"', answer: 'Who is Plato?' },
        ]
      },
      {
        name: 'Advanced Science',
        questions: [
          { clue: 'The SI unit of electric resistance', answer: 'What is the ohm?' },
          { clue: 'The process by which cells divide in two identical copies', answer: 'What is mitosis?' },
          { clue: 'The scientist who proposed the heliocentric model in 1543', answer: 'Who is Copernicus?' },
          { clue: 'The number of bones in the adult human body', answer: 'What is 206?' },
          { clue: 'The most abundant gas in Earth\'s atmosphere', answer: 'What is nitrogen?' },
        ]
      },
      {
        name: 'Classic Literature',
        questions: [
          { clue: 'Dante\'s epic poem about the afterlife', answer: 'What is The Divine Comedy?' },
          { clue: 'The author of "Crime and Punishment"', answer: 'Who is Dostoevsky?' },
          { clue: 'The narrator of "Moby-Dick"', answer: 'Who is Ishmael?' },
          { clue: 'James Joyce\'s stream-of-consciousness masterpiece', answer: 'What is Ulysses?' },
          { clue: 'The Greek epic that follows Odysseus home from Troy', answer: 'What is The Odyssey?' },
        ]
      },
      {
        name: 'Geography & Maps',
        questions: [
          { clue: 'The world\'s deepest lake by volume', answer: 'What is Lake Baikal?' },
          { clue: 'The capital of Kazakhstan', answer: 'What is Astana?' },
          { clue: 'The country with the most time zones', answer: 'What is France?' },
          { clue: 'The Strait that separates Europe from Africa', answer: 'What is the Strait of Gibraltar?' },
          { clue: 'The largest desert in the world', answer: 'What is Antarctica?' },
        ]
      },
      {
        name: 'Mathematics',
        questions: [
          { clue: 'The value of pi to 4 decimal places', answer: 'What is 3.1416?' },
          { clue: 'A triangle with all sides equal', answer: 'What is equilateral?' },
          { clue: 'The mathematician who proved Fermat\'s Last Theorem', answer: 'Who is Andrew Wiles?' },
          { clue: 'The study of rates of change in mathematics', answer: 'What is calculus?' },
          { clue: 'The formula for the area of a circle', answer: 'What is πr²?' },
        ]
      },
      {
        name: 'Economics',
        questions: [
          { clue: 'The author of "The Wealth of Nations"', answer: 'Who is Adam Smith?' },
          { clue: 'The economic theory that government spending stimulates growth', answer: 'What is Keynesian economics?' },
          { clue: 'GDP stands for this', answer: 'What is Gross Domestic Product?' },
          { clue: 'The stock market crash that triggered the Great Depression', answer: 'What is Black Tuesday?' },
          { clue: 'The currency used in Japan', answer: 'What is the yen?' },
        ]
      },
    ]
  },
  college: {
    categories: [
      {
        name: 'Political Theory',
        questions: [
          { clue: 'The author of "The Social Contract"', answer: 'Who is Rousseau?' },
          { clue: 'The political theorist who wrote "Leviathan"', answer: 'Who is Thomas Hobbes?' },
          { clue: 'The term for a government by the wealthy', answer: 'What is plutocracy?' },
          { clue: 'Marx\'s collaborator on "The Communist Manifesto"', answer: 'Who is Friedrich Engels?' },
          { clue: 'The political philosophy emphasizing individual liberty', answer: 'What is libertarianism?' },
        ]
      },
      {
        name: 'Science & Tech',
        questions: [
          { clue: 'The programming language created by Guido van Rossum', answer: 'What is Python?' },
          { clue: 'The theory describing quantum gravity is still called this', answer: 'What is the Theory of Everything?' },
          { clue: 'CRISPR is used to edit this molecule', answer: 'What is DNA?' },
          { clue: 'The company that created the first commercial microprocessor', answer: 'What is Intel?' },
          { clue: 'Alan Turing proposed this hypothetical computing machine', answer: 'What is the Turing Machine?' },
        ]
      },
      {
        name: 'Classic Films',
        questions: [
          { clue: 'Orson Welles\' debut film, widely considered the greatest ever', answer: 'What is Citizen Kane?' },
          { clue: 'The director of 2001: A Space Odyssey', answer: 'Who is Stanley Kubrick?' },
          { clue: 'The Italian neorealist film featuring a stolen bicycle', answer: 'What is Bicycle Thieves?' },
          { clue: 'Ingmar Bergman\'s film about Death playing chess', answer: 'What is The Seventh Seal?' },
          { clue: 'The French New Wave movement was led by this director of Breathless', answer: 'Who is Jean-Luc Godard?' },
        ]
      },
      {
        name: 'World Literature',
        questions: [
          { clue: 'The magical realist author of "One Hundred Years of Solitude"', answer: 'Who is Gabriel García Márquez?' },
          { clue: 'Kafka\'s novella about a man who wakes as a giant insect', answer: 'What is The Metamorphosis?' },
          { clue: 'The author of "Things Fall Apart"', answer: 'Who is Chinua Achebe?' },
          { clue: 'Tolstoy\'s epic novel set during the Napoleonic Wars', answer: 'What is War and Peace?' },
          { clue: 'The Japanese author of "Norwegian Wood"', answer: 'Who is Haruki Murakami?' },
        ]
      },
      {
        name: 'Economics & Finance',
        questions: [
          { clue: 'The term for the tendency of markets to self-correct', answer: 'What is the invisible hand?' },
          { clue: 'Black-Scholes is a model for pricing these financial instruments', answer: 'What are options?' },
          { clue: 'The economist who developed the theory of comparative advantage', answer: 'Who is David Ricardo?' },
          { clue: 'A market dominated by a few large sellers', answer: 'What is an oligopoly?' },
          { clue: 'The "paradox of thrift" is associated with this economist', answer: 'Who is Keynes?' },
        ]
      },
      {
        name: 'Philosophy & Ethics',
        questions: [
          { clue: 'Kant\'s universal moral law is called this', answer: 'What is the Categorical Imperative?' },
          { clue: 'The thought experiment involving a runaway trolley', answer: 'What is the Trolley Problem?' },
          { clue: 'Nietzsche declared this about God', answer: 'What is "God is dead"?' },
          { clue: 'The philosophical view that only the mind exists', answer: 'What is idealism?' },
          { clue: 'Sartre\'s claim that "existence precedes" this', answer: 'What is essence?' },
        ]
      },
    ]
  }
};
