"""Generate demo syllabus PDFs for every subject.

    py -3 scripts/make_syllabi.py            all subjects
    py -3 scripts/make_syllabi.py math       one subject

Writes two PDFs per subject into demo-syllabi/:
    <subject>-syllabus.pdf      handed to students, uploaded to the shared store
    <subject>-staff-notes.pdf   staff only, uploaded to the staff store

The content is invented demo material for Grade 12, Fall 2026. The section
layout follows real high school syllabi: course description, units, calendar,
materials, grading policy with a letter scale, make-up work, academic honesty.
Replace these with a school's real documents through the teacher panel.
"""
import os
import sys

from fpdf import FPDF

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "demo-syllabi")

SCHOOL = "Middletown High School"
TERM = "Grade 12, Fall Semester 2026"
# Fall 2026: classes Sep 8, mid-terms the week of Oct 19, finals the week of Dec 14.
COMMON_DATES = [
    ("Sep 8", "First day of classes"),
    ("Oct 19 to Oct 23", "Mid-term examination week"),
    ("Nov 6", "Parent teacher conferences"),
    ("Nov 25 to Nov 27", "Thanksgiving break, no classes"),
    ("Dec 14 to Dec 18", "Final examination week"),
]

# name, teacher, room, email, description, units, dates, materials, grading, notes
SUBJECTS = {
"math": dict(
    name="Mathematics: Calculus",
    teacher="Ms. A. Whitfield", room="214", email="awhitfield@middletownhigh.edu",
    description=(
        "A first course in calculus for seniors, equivalent to a first semester college course. "
        "Students work with limits, derivatives and integrals, and apply them to real problems "
        "using graphs, tables, algebra and clear written reasoning."),
    units=[
        ("Ch1: Algebra Foundations", "Weeks 1 to 2",
         "Linear equations, inequalities and systems. Solving for variables, graphing lines in the form y = mx + b, substitution and elimination."),
        ("Ch2: Quadratic Functions", "Weeks 3 to 5",
         "Standard form ax^2 + bx + c = 0 and vertex form y = a(x - h)^2 + k. The discriminant b^2 - 4ac decides the number of real roots. Factoring, completing the square and the quadratic formula."),
        ("Ch3: Trigonometry", "Weeks 6 to 8",
         "SOH CAH TOA, the unit circle, radians and degrees, sine, cosine and tangent with their inverses, and the identity sin^2(theta) + cos^2(theta) = 1."),
        ("Ch4: Introduction to Calculus", "Weeks 9 to 13",
         "Limits and continuity, the derivative as a rate of change, power, product and quotient rules, and an introduction to the definite integral."),
        ("Ch5: Statistics and Probability", "Weeks 14 to 16",
         "Measures of center and spread, normal distributions, conditional probability and interpreting data sets."),
    ],
    dates=[("Sep 25", "Ch2 Quiz, quadratic functions"),
           ("Oct 20", "Mid-Term Exam, covers Ch1 to Ch3"),
           ("Nov 13", "Ch4 Assignment due, derivatives in context"),
           ("Dec 15", "Final Exam, all chapters")],
    materials="Graphing calculator (TI-84 or equivalent), three ring binder, graph paper, pencils.",
    grading=[("Homework", 15), ("Classwork and participation", 15), ("Quizzes", 20),
             ("Unit tests", 25), ("Final exam", 25)],
    staff=dict(
        average=74, high=98, low=41,
        weak="Chapter 2, quadratic functions. Students lose the most points on completing the square and on reading the discriminant.",
        plan="Run two extra drill sessions before the mid-term. Re-teach completing the square with area models rather than formula recall.",
        extra="Four students are repeating the course and should be checked weekly. Calculator loans are available from the department office."),
),
"physics": dict(
    name="Physics",
    teacher="Mr. D. Oyelaran", room="108 Lab", email="doyelaran@middletownhigh.edu",
    description=(
        "An algebra based physics course built around laboratory work. Students measure motion, "
        "forces and energy, then use the data to test the models that describe them."),
    units=[
        ("Ch1: Kinematics", "Weeks 1 to 3",
         "Motion without reference to its causes. Key equations v = u + at, s = ut + 0.5at^2 and v^2 = u^2 + 2as. Projectile motion as uniform horizontal motion plus vertical free fall."),
        ("Ch2: Newton's Laws", "Weeks 4 to 6",
         "Inertia, F = ma, and equal and opposite reaction. Free body diagrams are required on all problems in this unit."),
        ("Ch3: Work, Energy and Power", "Weeks 7 to 9",
         "Work as force times displacement, kinetic and potential energy, conservation of energy, and power as the rate of doing work."),
        ("Ch4: Waves and Light", "Weeks 10 to 12",
         "Wave speed, frequency and wavelength, reflection and refraction, and the behavior of light through lenses."),
        ("Ch5: Electricity and Magnetism", "Weeks 13 to 16",
         "Current, voltage and resistance, Ohm's law, series and parallel circuits, and magnetic fields around a current."),
    ],
    dates=[("Oct 2", "Lab Report due: Motion"),
           ("Oct 22", "Mid-Term Exam, covers Ch1 to Ch3"),
           ("Nov 20", "Electricity Project due"),
           ("Dec 16", "Final Exam")],
    materials="Scientific calculator, lab notebook, safety goggles (provided, kept in the lab), ruler.",
    grading=[("Laboratory work and reports", 25), ("Homework", 15), ("Quizzes", 15),
             ("Unit tests", 25), ("Final exam", 20)],
    staff=dict(
        average=71, high=95, low=38,
        weak="Free body diagrams. Students who skip the diagram get the force sign wrong and lose the whole question.",
        plan="Require a labeled diagram for credit on every force problem, including quizzes.",
        extra="Goggles are mandatory for every electricity lab. A student without goggles is sent out and marked absent for that session."),
),
"chemistry": dict(
    name="Chemistry",
    teacher="Dr. P. Nandakumar", room="112 Lab", email="pnandakumar@middletownhigh.edu",
    description=(
        "A laboratory based chemistry course covering atomic structure, bonding, the mole and "
        "reactions. Students learn to predict what a reaction will do and then measure whether it did."),
    units=[
        ("Unit 1: Atomic Structure and Periodicity", "Weeks 1 to 3",
         "Protons, neutrons and electrons, electron configuration, and periodic trends in atomic radius, ionization energy and electronegativity across a period and down a group."),
        ("Unit 2: Chemical Bonding", "Weeks 4 to 6",
         "Ionic, covalent and metallic bonding, Lewis structures, molecular shapes and polarity."),
        ("Unit 3: Stoichiometry and the Mole", "Weeks 7 to 10",
         "The mole is 6.022 x 10^23 particles. Moles = mass divided by molar mass. Balance the equation before using mole ratios. The limiting reagent sets the maximum product."),
        ("Unit 4: Acids, Bases and pH", "Weeks 11 to 13",
         "Strong and weak acids and bases, the pH scale, neutralization and titration technique."),
        ("Unit 5: Organic Chemistry Foundations", "Weeks 14 to 16",
         "Hydrocarbons, functional groups and naming simple organic compounds."),
    ],
    dates=[("Sep 30", "Unit 2 Bonding Quiz"),
           ("Oct 21", "Mid-Term Exam, covers Units 1 to 3"),
           ("Nov 18", "Titration Lab Report due"),
           ("Dec 14", "Final Exam, all units")],
    materials="Scientific calculator, lab notebook, closed toe shoes for lab days, periodic table (provided).",
    grading=[("Laboratory work", 25), ("Homework", 10), ("Quizzes", 15),
             ("Unit tests", 30), ("Final exam", 20)],
    staff=dict(
        average=72, high=97, low=44,
        weak="Mole calculations in Unit 3. This is the single biggest stumbling block every year.",
        plan="Add two worked example sessions before the mid-term and a mole conversion check-in quiz in week 8.",
        extra="Goggles and lab coats are mandatory for every lab session. Students without goggles are sent out and marked absent."),
),
"biology": dict(
    name="Biology",
    teacher="Ms. R. Castellanos", room="117 Lab", email="rcastellanos@middletownhigh.edu",
    description=(
        "A survey of life from the cell to the ecosystem, with microscope work, dissection and a "
        "field study. Students practice reading data and explaining what a result does and does not show."),
    units=[
        ("Unit 1: Cell Structure and Function", "Weeks 1 to 3",
         "Prokaryotic and eukaryotic cells. Nucleus, mitochondria for respiration, ribosomes for protein synthesis and chloroplasts for photosynthesis in plants. Diffusion, osmosis and active transport."),
        ("Unit 2: Genetics and Inheritance", "Weeks 4 to 7",
         "DNA as a double helix with base pairs A to T and C to G. Mitosis makes identical body cells, meiosis makes gametes. Punnett squares predict offspring ratios for dominant and recessive alleles."),
        ("Unit 3: Evolution and Natural Selection", "Weeks 8 to 10",
         "Variation, selection pressure, speciation and the evidence from fossils, anatomy and DNA."),
        ("Unit 4: Human Body Systems", "Weeks 11 to 13",
         "Circulatory, respiratory, digestive and nervous systems, and how they maintain homeostasis."),
        ("Unit 5: Ecology", "Weeks 14 to 16",
         "Energy flow through food webs, nutrient cycles, population growth and human impact."),
    ],
    dates=[("Sep 24", "Microscope Lab"),
           ("Oct 19", "Mid-Term Exam, covers Units 1 to 2"),
           ("Nov 12", "Ecology Field Report due"),
           ("Dec 15", "Final Exam")],
    materials="Lab notebook, colored pencils for diagrams, scientific calculator.",
    grading=[("Laboratory and field work", 20), ("Homework", 15), ("Quizzes", 15),
             ("Unit tests", 30), ("Final exam", 20)],
    staff=dict(
        average=77, high=99, low=49,
        weak="Students confuse mitosis and meiosis every year, usually the chromosome number after each division.",
        plan="Use the side by side comparison table from week 5 and quiz on it twice before the mid-term.",
        extra="The field report counts for 20 percent of the grade. Transport consent forms are due by Oct 30."),
),
"english": dict(
    name="English Literature",
    teacher="Mr. J. Abernathy", room="305", email="jabernathy@middletownhigh.edu",
    description=(
        "A literature and composition course. Students read short fiction, poetry, drama and a "
        "modern novel, and write analytical essays that make an argument and support it with text."),
    units=[
        ("Unit 1: Short Stories", "Weeks 1 to 3",
         "Narrative structure, point of view, characterization and theme in American and world short fiction."),
        ("Unit 2: Poetry Analysis", "Weeks 4 to 6",
         "Imagery, metaphor, simile, personification and alliteration. Featured poets include Langston Hughes, Emily Dickinson and Sylvia Plath."),
        ("Unit 3: Shakespeare, Macbeth", "Weeks 7 to 10",
         "Close reading of the play. Act 1 Scene 7 is the soliloquy where Macbeth weighs murdering King Duncan. Themes are ambition, guilt, and fate against free will."),
        ("Unit 4: Modern Fiction", "Weeks 11 to 13",
         "One full length novel with attention to voice, structure and historical context."),
        ("Unit 5: Essay Writing", "Weeks 14 to 16",
         "Thesis construction, evidence selection, counterargument and revision."),
    ],
    dates=[("Sep 29", "Poetry Essay due"),
           ("Oct 26", "Macbeth Scene Analysis due"),
           ("Nov 17", "Book Report due"),
           ("Dec 16", "Final Exam")],
    materials="Class texts (provided), composition notebook, highlighters, access to a word processor.",
    grading=[("Essays and writing", 35), ("Class participation", 15), ("Reading quizzes", 15),
             ("Unit tests", 15), ("Final exam", 20)],
    staff=dict(
        average=79, high=96, low=55,
        weak="Thesis construction. Essays describe the text instead of arguing a position about it.",
        plan="Require a one sentence thesis submitted and approved before any essay draft is accepted.",
        extra="Participation is 15 percent of the final mark and must be recorded weekly, not estimated at the end of term."),
),
"history": dict(
    name="Modern World History",
    teacher="Ms. L. Brennan", room="221", email="lbrennan@middletownhigh.edu",
    description=(
        "A study of the modern world from industrialization to the Cold War, built on primary "
        "sources. Students learn to weigh evidence and to explain causes rather than list events."),
    units=[
        ("Unit 1: The Industrial Revolution", "Weeks 1 to 3",
         "Mechanization, urban growth, labor conditions and the social movements that followed."),
        ("Unit 2: World War I", "Weeks 4 to 6",
         "Long term causes were militarism, alliances, imperialism and nationalism, remembered as MAIN. The short term trigger was the assassination of Archduke Franz Ferdinand in June 1914."),
        ("Unit 3: The Interwar Years and the Great Depression", "Weeks 7 to 9",
         "The 1929 Wall Street Crash, mass unemployment, and the rise of extremist parties. The Treaty of Versailles fueled resentment in Germany."),
        ("Unit 4: World War II", "Weeks 10 to 13",
         "Causes, the major theaters, the Holocaust, and the postwar settlement."),
        ("Unit 5: The Cold War", "Weeks 14 to 16",
         "Containment, proxy conflicts, the arms race and the collapse of the Soviet bloc."),
    ],
    dates=[("Sep 28", "Source Analysis Essay due"),
           ("Oct 23", "Mid-Term Exam, covers Units 1 to 3"),
           ("Nov 19", "Research Project due"),
           ("Dec 18", "Final Exam")],
    materials="Textbook (provided), notebook, folder for primary source packets.",
    grading=[("Essays and source analysis", 30), ("Research project", 25), ("Quizzes", 10),
             ("Unit tests", 15), ("Final exam", 20)],
    staff=dict(
        average=75, high=94, low=51,
        weak="Essays describe events rather than analyze them. Few students answer the why question directly.",
        plan="Mark a sample paragraph together in week 4 and hand out the analysis checklist before the first essay.",
        extra="Research project proposals are due Oct 30 so there is time to redirect weak topics."),
),
"geography": dict(
    name="Geography",
    teacher="Mr. S. Ibarra", room="118", email="sibarra@middletownhigh.edu",
    description=(
        "Physical and human geography, from plate tectonics to cities and resources, including a "
        "river fieldwork study with data collected by the class."),
    units=[
        ("Unit 1: Plate Tectonics and Hazards", "Weeks 1 to 3",
         "Constructive (divergent), destructive (convergent) and conservative (transform) boundaries. Earthquakes occur at all three. Volcanoes occur mainly at constructive and destructive boundaries."),
        ("Unit 2: Weather and Climate", "Weeks 4 to 6",
         "Air pressure, fronts, the global circulation and the difference between weather and climate."),
        ("Unit 3: Rivers and Coasts", "Weeks 7 to 10",
         "Erosion by hydraulic action, abrasion, attrition and solution, then transport and deposition. Landforms include waterfalls, meanders, ox bow lakes and floodplains."),
        ("Unit 4: Urbanization", "Weeks 11 to 13",
         "City growth, land use models, informal settlements and sustainable urban planning."),
        ("Unit 5: Resource Management", "Weeks 14 to 16",
         "Water, energy and food security, and the trade offs between them."),
    ],
    dates=[("Oct 1", "Map Skills Test"),
           ("Oct 26", "Mid-Term Exam, covers Units 1 to 2"),
           ("Nov 10", "River Fieldwork Write-up due"),
           ("Dec 17", "Final Exam")],
    materials="Atlas (provided), ruler, colored pencils, waterproof jacket and boots for fieldwork day.",
    grading=[("Fieldwork and write-up", 20), ("Homework", 15), ("Map and skills tests", 15),
             ("Unit tests", 30), ("Final exam", 20)],
    staff=dict(
        average=78, high=95, low=52,
        weak="Case study detail. Answers stay general where named places and figures are required.",
        plan="Issue the case study fact sheet in week 6 and test recall of named examples in the mid-term.",
        extra="Fieldwork is Nov 3, weather permitting. The reserve date is Nov 5."),
),
"cs": dict(
    name="Computer Science",
    teacher="Ms. K. Oduya", room="Lab B", email="koduya@middletownhigh.edu",
    description=(
        "An introduction to programming and computer systems in Python. Students write working "
        "programs, reason about how long they take to run, and store data in a database."),
    units=[
        ("Unit 1: Programming Fundamentals in Python", "Weeks 1 to 4",
         "Variables, types, conditionals, loops, functions and reading error messages."),
        ("Unit 2: Data Structures", "Weeks 5 to 7",
         "Lists, stacks which are last in first out, queues which are first in first out, and dictionaries which store key and value pairs. Choose the structure by how data is added and removed."),
        ("Unit 3: Algorithms, Searching and Sorting", "Weeks 8 to 10",
         "Linear search checks each item and is O(n). Binary search halves a sorted list each step and is O(log n). Bubble sort is O(n^2) and merge sort is O(n log n)."),
        ("Unit 4: Computer Networks", "Weeks 11 to 13",
         "Packets, IP addressing, the client and server model, and basic web requests."),
        ("Unit 5: Databases and SQL", "Weeks 14 to 16",
         "Tables, keys, and SELECT, WHERE and JOIN queries."),
    ],
    dates=[("Sep 23", "Python Mini-Project due"),
           ("Oct 19", "Mid-Term Exam, covers Units 1 to 3"),
           ("Dec 4", "Final Project due"),
           ("Dec 15", "Final Exam")],
    materials="School laptop or personal machine with Python 3 installed, USB drive or cloud folder for backups.",
    grading=[("Programming assignments", 25), ("Final project", 30), ("Quizzes", 10),
             ("Unit tests", 15), ("Final exam", 20)],
    staff=dict(
        average=81, high=100, low=47,
        weak="Big O notation. Students can name the complexities but cannot justify them from the code.",
        plan="Add a weekly five minute trace exercise where students count operations by hand.",
        extra="The academic honesty policy applies to all code. Run a similarity check on the final project before grading."),
),
"economics": dict(
    name="Economics",
    teacher="Mr. T. Vandermeer", room="226", email="tvandermeer@middletownhigh.edu",
    description=(
        "An introduction to microeconomics and macroeconomics. Students use diagrams and real data "
        "to explain prices, unemployment, inflation and policy choices."),
    units=[
        ("Unit 1: Supply and Demand", "Weeks 1 to 3",
         "The law of demand says that as price rises, quantity demanded falls. Equilibrium is where supply meets demand. A shift of the whole curve comes from non price factors such as income or tastes."),
        ("Unit 2: Market Structures", "Weeks 4 to 6",
         "Perfect competition, monopoly, oligopoly and monopolistic competition, and why market power changes price."),
        ("Unit 3: Macroeconomic Indicators", "Weeks 7 to 10",
         "GDP, inflation measured by the consumer price index, and unemployment, with the limits of each measure."),
        ("Unit 4: Fiscal and Monetary Policy", "Weeks 11 to 13",
         "Fiscal policy is government spending and taxation. Monetary policy is the central bank setting interest rates and the money supply. Higher interest rates usually reduce inflation."),
        ("Unit 5: International Trade", "Weeks 14 to 16",
         "Comparative advantage, tariffs and quotas, and exchange rates."),
    ],
    dates=[("Oct 5", "Market Analysis Assignment due"),
           ("Oct 22", "Mid-Term Exam, covers Units 1 to 3"),
           ("Nov 18", "Policy Debate"),
           ("Dec 16", "Final Exam")],
    materials="Notebook, ruler for diagrams, calculator, access to current news sources.",
    grading=[("Assignments", 20), ("Policy debate", 10), ("Quizzes", 15),
             ("Unit tests", 35), ("Final exam", 20)],
    staff=dict(
        average=76, high=96, low=50,
        weak="Diagram labeling. Unlabeled axes cost easy marks on nearly every test.",
        plan="Refuse unlabeled diagrams on homework from week 3 so the habit forms before the mid-term.",
        extra="Debate groups are assigned Nov 4. Balance confident speakers across groups."),
),
"french": dict(
    name="French IV",
    teacher="Mme. C. Lefevre", room="310", email="clefevre@middletownhigh.edu",
    description=(
        "A fourth year French course taught largely in French. Students move between past, present "
        "and future tenses in speech and writing, and study culture across the French speaking world."),
    units=[
        ("Unit 1: Present Tense and Everyday Conversation", "Weeks 1 to 3",
         "Regular and irregular present tense verbs, question forms and everyday vocabulary."),
        ("Unit 2: Passe Compose and Imparfait", "Weeks 4 to 7",
         "Passe compose uses avoir or etre with a past participle for completed actions, for example j'ai mange. Imparfait describes ongoing or repeated past actions, for example je mangeais. Verbs of movement take etre."),
        ("Unit 3: Travel and Directions", "Weeks 8 to 10",
         "Useful phrases include Ou est la gare, meaning where is the station, tournez a gauche or a droite for turn left or right, and allez tout droit for go straight on."),
        ("Unit 4: Future and Conditional Tenses", "Weeks 11 to 13",
         "Futur simple and conditionnel, with si clauses."),
        ("Unit 5: Cultures of the French Speaking World", "Weeks 14 to 16",
         "Readings and short films from France, Senegal, Quebec and Morocco."),
    ],
    dates=[("Sep 26", "Vocabulary Quiz"),
           ("Oct 27", "Mid-Term Exam, written and oral, Units 1 to 2"),
           ("Nov 17", "Oral Presentation"),
           ("Dec 18", "Final Exam")],
    materials="Textbook and workbook (provided), bilingual dictionary, headphones for listening practice.",
    grading=[("Speaking and oral work", 30), ("Writing", 20), ("Listening and reading quizzes", 15),
             ("Unit tests", 15), ("Final exam", 20)],
    staff=dict(
        average=74, high=98, low=46,
        weak="Oral confidence. Written scores are a full grade above spoken scores for most of the class.",
        plan="Five minutes of paired speaking at the start of every lesson, with rotating partners.",
        extra="Oral components are 30 percent of the grade. Record the oral exam for moderation."),
),
"art": dict(
    name="Visual Arts",
    teacher="Ms. H. Okonkwo", room="Studio 2", email="hokonkwo@middletownhigh.edu",
    description=(
        "A studio course building a personal portfolio. Students draw from observation, study color "
        "and composition, look at art history, and write short reflections on their own work."),
    units=[
        ("Unit 1: Drawing and Observation", "Weeks 1 to 3",
         "Line, proportion, perspective and value drawing from still life and the figure."),
        ("Unit 2: Color Theory", "Weeks 4 to 6",
         "Primary colors are red, yellow and blue. Complementary colors sit opposite each other on the color wheel and create contrast. Warm colors advance and cool colors recede."),
        ("Unit 3: Art History, Renaissance to Modernism", "Weeks 7 to 9",
         "The Renaissance introduced linear perspective. Impressionism, for example Monet, captured light and the moment. Cubism, for example Picasso, showed several viewpoints at once."),
        ("Unit 4: Mixed Media", "Weeks 10 to 13",
         "Collage, printmaking and combining materials with intent."),
        ("Unit 5: Personal Portfolio", "Weeks 14 to 16",
         "Developing a coherent body of work and preparing it for exhibition."),
    ],
    dates=[("Oct 2", "Observational Drawing Portfolio check"),
           ("Oct 28", "Mid-Term Critique"),
           ("Nov 20", "Mixed Media Piece due"),
           ("Dec 11", "Final Portfolio Exhibition")],
    materials="Sketchbook (A3), graphite pencil set, eraser, brushes. Paint and paper are provided.",
    grading=[("Portfolio", 60), ("Sketchbook and reflections", 20), ("Critique participation", 10),
             ("Art history quizzes", 10)],
    staff=dict(
        average=84, high=98, low=61,
        weak="Sketchbook annotation. Strong work arrives with no written reflection, which costs portfolio marks.",
        plan="Require a short written reflection attached to every submitted piece, no exceptions.",
        extra="The portfolio is 60 percent of the grade. Exhibition setup is Dec 10 after school."),
),
"pe": dict(
    name="Physical Education",
    teacher="Coach M. Delgado", room="Gymnasium", email="mdelgado@middletownhigh.edu",
    description=(
        "A senior course combining practical sport with the theory behind training. Students test "
        "their own fitness, learn how the body responds to exercise, and write a personal training plan."),
    units=[
        ("Unit 1: Fitness Components and Testing", "Weeks 1 to 3",
         "The components of fitness are cardiovascular endurance, muscular strength, muscular endurance, flexibility and body composition. The beep test measures cardiovascular endurance."),
        ("Unit 2: Anatomy and Physiology", "Weeks 4 to 6",
         "Major muscle groups, the skeletal system, and how the heart and lungs respond to exercise."),
        ("Unit 3: Team Sports, Basketball and Soccer", "Weeks 7 to 10",
         "Skills, positions, rules and game strategy, assessed in play."),
        ("Unit 4: Health and Nutrition", "Weeks 11 to 13",
         "Energy balance, macronutrients, hydration and recovery."),
        ("Unit 5: Personal Fitness Plan", "Weeks 14 to 16",
         "Designing, following and evaluating a six week training program."),
    ],
    dates=[("Sep 22", "Baseline Fitness Test"),
           ("Oct 19", "Mid-Term Theory Test, covers Units 1 to 2"),
           ("Nov 13", "Personal Fitness Plan due"),
           ("Dec 10", "Final Practical Assessment")],
    materials="Full PE kit and sneakers are required for every practical lesson. No jewelry. Bring a water bottle.",
    grading=[("Practical performance", 40), ("Personal fitness plan", 20), ("Theory tests", 25),
             ("Participation and effort", 15)],
    staff=dict(
        average=80, high=97, low=58,
        weak="Theory marks lag practical marks by about fifteen points for most of the class.",
        plan="Add a five question written quiz at the end of every practical lesson.",
        extra="Two students have medical exemptions on file and are assessed on the written components only."),
),
}

GRADE_SCALE = "A = 90 to 100 percent, B = 80 to 89, C = 70 to 79, D = 60 to 69, F = 59 and below."
MAKEUP = ("Work handed in late without an excused absence receives a maximum of 50 percent credit. "
          "With an excused absence, work is due within one week of returning. It is the student's "
          "responsibility to ask what was missed. Make-up tests are held on Thursdays after school "
          "and must be booked at least one day ahead.")
HONESTY = ("All work submitted must be your own. Copying another student's work, or submitting text "
           "or code generated by someone or something else as your own, is treated as academic "
           "dishonesty and results in a zero for that assignment and a call home.")
HELP = "Extra help is available Tuesdays and Thursdays, 3:15 to 4:00 pm, in the room listed above."


class Doc(FPDF):
    def __init__(self, title):
        super().__init__()
        self.title_text = title
        self.set_auto_page_break(auto=True, margin=18)
        self.add_page()

    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(110)
        usable = self.w - self.l_margin - self.r_margin
        self.cell(usable / 2, 5, SCHOOL, align="L")
        self.cell(usable / 2, 5, TERM, align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200)
        self.line(10, 18, 200, 18)
        self.ln(6)
        self.set_text_color(0)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(130)
        self.cell(0, 5, f"{self.title_text}  |  page {self.page_no()} of {{nb}}", align="C")

    def h1(self, text):
        self.set_font("Helvetica", "B", 16)
        self.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h2(self, text):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(30, 30, 90)
        self.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0)
        self.ln(0.5)

    def body(self, text, bold=False, size=10):
        self.set_font("Helvetica", "B" if bold else "", size)
        self.multi_cell(0, 5, text, new_x="LMARGIN", new_y="NEXT")

    def kv(self, label, value):
        self.set_font("Helvetica", "B", 10)
        self.cell(32, 5, label)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5, value, new_x="LMARGIN", new_y="NEXT")

    def row(self, left, right, lw=38):
        self.set_font("Helvetica", "B", 10)
        self.cell(lw, 5, left)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(0, 5, right, new_x="LMARGIN", new_y="NEXT")


def ascii_only(s):
    """fpdf2's core fonts are latin-1; keep the text safely inside it."""
    return (s.replace("’", "'").replace("‘", "'")
             .replace("“", '"').replace("”", '"'))


def syllabus_pdf(sid, s):
    title = f"{s['name']} Syllabus"
    d = Doc(title)
    d.h1(ascii_only(f"{s['name']}"))
    d.body(ascii_only(f"{SCHOOL}  |  {TERM}"), size=10)
    d.ln(2)
    for label, value in [("Teacher:", s["teacher"]), ("Room:", s["room"]), ("Email:", s["email"])]:
        d.kv(label, ascii_only(value))

    d.h2("Course Description")
    d.body(ascii_only(s["description"]))

    d.h2("Course Units")
    for name, weeks, detail in s["units"]:
        d.row(ascii_only(weeks), ascii_only(name), lw=32)
        d.set_font("Helvetica", "", 9.5)
        d.set_x(d.l_margin + 32)
        d.multi_cell(0, 4.6, ascii_only(detail), new_x="LMARGIN", new_y="NEXT")
        d.ln(1)

    d.h2("Key Dates This Semester")
    for date, event in s["dates"]:
        d.row(ascii_only(date), ascii_only(event), lw=32)
    d.ln(1)
    d.set_font("Helvetica", "B", 10)
    d.multi_cell(0, 5, "School wide dates", new_x="LMARGIN", new_y="NEXT")
    for date, event in COMMON_DATES:
        d.row(ascii_only(date), ascii_only(event), lw=32)

    d.h2("Materials")
    d.body(ascii_only(s["materials"]))

    d.h2("Grading Policy")
    for cat, pct in s["grading"]:
        d.row(f"{pct} percent", ascii_only(cat), lw=32)
    d.ln(1)
    d.body(ascii_only(GRADE_SCALE))

    d.h2("Late and Make-Up Work")
    d.body(ascii_only(MAKEUP))

    d.h2("Academic Honesty")
    d.body(ascii_only(HONESTY))

    d.h2("Extra Help")
    d.body(ascii_only(HELP))

    path = os.path.join(OUT, f"{sid}-syllabus.pdf")
    d.output(path)
    return path


def staff_pdf(sid, s):
    st = s["staff"]
    title = f"{s['name']} Staff Notes"
    d = Doc(title)
    d.h1(ascii_only(f"{s['name']}: Staff Notes"))
    d.set_font("Helvetica", "B", 11)
    d.set_text_color(150, 0, 0)
    d.multi_cell(0, 6, "STAFF ONLY. Not for distribution to students.", new_x="LMARGIN", new_y="NEXT")
    d.set_text_color(0)
    d.body(ascii_only(f"{SCHOOL}  |  {TERM}  |  {s['teacher']}"))

    d.h2("Class Performance")
    d.row("Class average", f"{st['average']} percent", lw=42)
    d.row("Highest score", f"{st['high']} percent", lw=42)
    d.row("Lowest score", f"{st['low']} percent", lw=42)

    d.h2("Weak Area Identified")
    d.body(ascii_only(st["weak"]))

    d.h2("Intervention Plan")
    d.body(ascii_only(st["plan"]))

    d.h2("Grading Breakdown Held by Staff")
    for cat, pct in s["grading"]:
        d.row(f"{pct} percent", ascii_only(cat), lw=32)

    d.h2("Department Notes")
    d.body(ascii_only(st["extra"]))

    path = os.path.join(OUT, f"{sid}-staff-notes.pdf")
    d.output(path)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    targets = [only] if only else list(SUBJECTS)
    for sid in targets:
        if sid not in SUBJECTS:
            print(f"  ! unknown subject {sid}")
            continue
        s = SUBJECTS[sid]
        a = syllabus_pdf(sid, s)
        b = staff_pdf(sid, s)
        print(f"  {sid:10s} {os.path.basename(a)} ({os.path.getsize(a)//1024} KB), "
              f"{os.path.basename(b)} ({os.path.getsize(b)//1024} KB)")
    print("done.")


if __name__ == "__main__":
    main()
