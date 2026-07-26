export interface DayStoryRow {
  icon: string;
  title: string;
  who: string;
  whoClass: 'ld-w-mom' | 'ld-w-dad' | 'ld-w-gma' | 'ld-w-nanny';
  note: string;
  time: string;
}

export interface TrackingChip {
  icon: string;
  label: string;
}

export interface LandingPlan {
  id: 'monthly' | 'lifetime';
  tag: string;
  name: string;
  price: string;
  priceUnit: string;
  per: string;
  features: string[];
  cta: string;
  hot: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const GITHUB_URL = 'https://github.com/Oak-and-Sprout/sprout-track';
export const DEMO_URL = '/demo';

export const DAY_STORY_ROWS: DayStoryRow[] = [
  { icon: '/bottle-256.png', title: 'Bottle, 5.5 oz', who: 'Tom', whoClass: 'ld-w-dad', note: 'Logged before the coffee finished brewing.', time: '6:05 am' },
  { icon: '/crib-256.png', title: 'Nap started', who: 'Priya', whoClass: 'ld-w-nanny', note: 'Betty watches the sleep timer tick from her desk at work.', time: '9:40 am' },
  { icon: '/diaper-256.png', title: 'Wet diaper', who: 'Grandma', whoClass: 'ld-w-gma', note: 'Zero “did anyone change him?” texts sent today.', time: '12:15 pm' },
  { icon: '/food-256.png', title: 'First avocado', who: 'Betty', whoClass: 'ld-w-mom', note: 'Marked as a milestone, photo attached for the grandparents.', time: '3:30 pm' },
  { icon: '/bath-256.png', title: 'Bath and bedtime', who: 'Tom', whoClass: 'ld-w-dad', note: 'Tomorrow morning, whoever wakes up first picks up right here.', time: '7:55 pm' },
];

export const TRACKING_CHIPS: TrackingChip[] = [
  { icon: '/crib-256.png', label: 'Sleep & naps' },
  { icon: '/bottle-256.png', label: 'Bottle feeds' },
  { icon: '/breastfeed-128.png', label: 'Breastfeeding' },
  { icon: '/food-256.png', label: 'Solid foods' },
  { icon: '/diaper-256.png', label: 'Diapers' },
  { icon: '/pump-256.png', label: 'Pumping' },
  { icon: '/med-256.png', label: 'Medicine & vitamins' },
  { icon: '/bath-256.png', label: 'Baths' },
  { icon: '/milestone-256.png', label: 'Milestones' },
  { icon: '/measurement-256.png', label: 'Measurements' },
  { icon: '/vaccine-256.png', label: 'Vaccines' },
  { icon: '/activity-256.png', label: 'Activities & tummy time' },
  { icon: '/note-256.png', label: 'Notes' },
  { icon: '/photo-192.png', label: 'Photos' },
  { icon: '/breastfeed-128.png', label: 'Breast milk storage' },
];

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: 'monthly',
    tag: 'Most popular',
    name: 'Hosted Monthly',
    price: '$2.99',
    priceUnit: '/month',
    per: 'after a 14-day free trial',
    features: [
      'Every feature, nothing gated',
      'Unlimited caretakers and babies',
      'Hosting, backups, and updates handled',
      'Cancel anytime, export everything',
    ],
    cta: 'Start my free trial',
    hot: true,
  },
  {
    id: 'lifetime',
    tag: 'Best value',
    name: 'Lifetime',
    price: '$19.99',
    priceUnit: 'once',
    per: 'pays for itself in 7 months',
    features: [
      'Everything in Hosted Monthly',
      'One payment, yours for good',
      'Covers future babies too',
      'All updates included',
    ],
    cta: 'Get lifetime access',
    hot: false,
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What happens when the trial ends?',
    answer: 'You’ll get a heads-up before day 14. If you don’t subscribe, your account pauses; nothing is deleted, and you can export your data or pick a plan whenever you’re ready.',
  },
  {
    question: 'Do grandparents and nannies cost extra?',
    answer: 'No. One plan covers your whole family: unlimited caretakers and unlimited babies, always.',
  },
  {
    question: 'Can I take my data with me?',
    answer: 'Yes, always. Export your full history anytime. And because Sprout Track is open source, you can move from our hosting to your own server and keep everything.',
  },
  {
    question: 'What does Lifetime actually include?',
    answer: 'Everything, forever: hosting, all features, and all future updates, for one $19.99 payment. If you track more than seven months, it’s the cheaper option.',
  },
  {
    question: 'How is the hosted version different from self-hosting?',
    answer: 'The software is identical. With hosting we run the server, keep backups, and apply updates, so it just works from any device. Self-hosting is the same app on your own machine, free.',
  },
  {
    question: 'Is my baby’s data private?',
    answer: 'Yes. No ads, no trackers, no selling data. The code is public on GitHub, so you don’t have to take our word for it.',
  },
];
