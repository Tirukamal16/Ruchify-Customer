export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  /** From API: 1-decimal avg rating string, or null for brand-new items (show "New"). */
  avgRating?: string | null;
  totalRatings?: number;
  isVeg: boolean;
  category: string;
  popular?: boolean;
  portionSize?: string; // e.g. "Serves 1-2" or "250g"
  sizes?: { name: string; priceAddon: number }[];
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  rating: number;
  deliveryTime: string;
  distance: string;
  distanceKm?: number; // numeric km, used for sorting
  costForTwo: number;
  image: string;
  offer?: string;
  isVeg?: boolean;
  address: string;
  openTime: string;
  closeTime: string;
  menu: MenuItem[];
  latitude?: number;
  longitude?: number;
}

export const categories = [
  { id: 'biryani', name: 'Biryani', icon: 'flame-outline' as const, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop' },
  { id: 'chaat', name: 'Chaat', icon: 'leaf-outline' as const, image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=200&h=200&fit=crop' },
  { id: 'south indian', name: 'South Indian', icon: 'restaurant-outline' as const, image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200&h=200&fit=crop' },
  { id: 'burger', name: 'Burger', icon: 'fast-food-outline' as const, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop' },
  { id: 'pizza', name: 'Pizza', icon: 'pizza-outline' as const, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop' },
  { id: 'chinese', name: 'Chinese', icon: 'restaurant-outline' as const, image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200&h=200&fit=crop' },
  { id: 'desserts', name: 'Desserts', icon: 'ice-cream-outline' as const, image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&h=200&fit=crop' },
  { id: 'healthy', name: 'Healthy', icon: 'leaf-outline' as const, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop' },
  { id: 'coffee', name: 'Coffee', icon: 'cafe-outline' as const, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&h=200&fit=crop' },
  { id: 'sandwich', name: 'Sandwich', icon: 'nutrition-outline' as const, image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=200&h=200&fit=crop' },
  { id: 'tiffin', name: 'Tiffin', icon: 'restaurant-outline' as const, image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=200&h=200&fit=crop' },
  { id: 'meals', name: 'Meals', icon: 'flame-outline' as const, image: 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=200&h=200&fit=crop' },
];

export const restaurants: Restaurant[] = [
  {
    id: '1',
    name: 'The Pizza Place',
    cuisine: ['Pizza', 'Italian', 'Fast Food'],
    rating: 4.5,
    deliveryTime: '25-30 min',
    distance: '1.2 km',
    costForTwo: 500,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
    offer: '30% OFF up to $75',
    address: '123 Main Street, Downtown',
    openTime: '10:00 AM',
    closeTime: '11:00 PM',
    menu: [
      { id: '1-1', name: 'Margherita Pizza', description: 'Classic pizza with fresh mozzarella, tomato sauce, and basil', price: 249, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300&h=200&fit=crop', rating: 4.6, isVeg: true, category: 'pizza', popular: true },
      { id: '1-2', name: 'Pepperoni Feast', description: 'Loaded with double pepperoni and extra cheese', price: 349, image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=300&h=200&fit=crop', rating: 4.7, isVeg: false, category: 'pizza', popular: true },
      { id: '1-3', name: 'BBQ Chicken Pizza', description: 'Smoky BBQ sauce, grilled chicken, red onions, cilantro', price: 399, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop', rating: 4.4, isVeg: false, category: 'pizza' },
      { id: '1-4', name: 'Veggie Supreme', description: 'Bell peppers, mushrooms, olives, onions, and corn', price: 299, image: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=300&h=200&fit=crop', rating: 4.3, isVeg: true, category: 'pizza' },
      { id: '1-5', name: 'Garlic Bread', description: 'Crispy garlic bread with herbs and butter', price: 129, image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=300&h=200&fit=crop', rating: 4.5, isVeg: true, category: 'sides' },
      { id: '1-6', name: 'Cheesy Fries', description: 'Crispy fries topped with melted cheddar cheese', price: 149, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=200&fit=crop', rating: 4.2, isVeg: true, category: 'sides' },
    ],
  },
  {
    id: '2',
    name: 'Burger Hub',
    cuisine: ['Burger', 'American', 'Fast Food'],
    rating: 4.3,
    deliveryTime: '20-25 min',
    distance: '0.8 km',
    costForTwo: 400,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop',
    offer: 'FREE delivery',
    address: '456 Oak Avenue, Midtown',
    openTime: '11:00 AM',
    closeTime: '10:00 PM',
    menu: [
      { id: '2-1', name: 'Classic Smash Burger', description: 'Double smashed patties with American cheese, pickles, and special sauce', price: 199, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop', rating: 4.5, isVeg: false, category: 'burger', popular: true },
      { id: '2-2', name: 'Chicken Zinger', description: 'Crispy fried chicken patty with spicy mayo and coleslaw', price: 229, image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300&h=200&fit=crop', rating: 4.4, isVeg: false, category: 'burger', popular: true },
      { id: '2-3', name: 'Veggie Delight Burger', description: 'Plant-based patty with fresh lettuce, tomato, and avocado', price: 179, image: 'https://images.unsplash.com/photo-1520072959219-c595e6cdc392?w=300&h=200&fit=crop', rating: 4.2, isVeg: true, category: 'burger' },
      { id: '2-4', name: 'Loaded Nachos', description: 'Tortilla chips with cheese sauce, jalapenos, and salsa', price: 159, image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=300&h=200&fit=crop', rating: 4.1, isVeg: true, category: 'sides' },
      { id: '2-5', name: 'Chocolate Shake', description: 'Thick and creamy chocolate milkshake', price: 129, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=200&fit=crop', rating: 4.6, isVeg: true, category: 'desserts' },
    ],
  },
  {
    id: '3',
    name: 'Royal Biryani House',
    cuisine: ['Biryani', 'North Indian', 'Mughlai'],
    rating: 4.6,
    deliveryTime: '35-40 min',
    distance: '2.5 km',
    costForTwo: 600,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop',
    offer: '20% OFF on first order',
    address: '789 Spice Road, Old Town',
    openTime: '11:30 AM',
    closeTime: '11:30 PM',
    menu: [
      { id: '3-1', name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with tender chicken and aromatic spices', price: 299, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&h=200&fit=crop', rating: 4.7, isVeg: false, category: 'biryani', popular: true },
      { id: '3-2', name: 'Mutton Biryani', description: 'Slow-cooked mutton with saffron-infused rice', price: 399, image: 'https://images.unsplash.com/photo-1642821373181-696a54913e93?w=300&h=200&fit=crop', rating: 4.8, isVeg: false, category: 'biryani', popular: true },
      { id: '3-3', name: 'Veg Biryani', description: 'Mixed vegetables with basmati rice and special spice blend', price: 229, image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=300&h=200&fit=crop', rating: 4.3, isVeg: true, category: 'biryani' },
      { id: '3-4', name: 'Butter Chicken', description: 'Creamy tomato-based curry with tender chicken tikka', price: 329, image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&h=200&fit=crop', rating: 4.6, isVeg: false, category: 'chinese' },
      { id: '3-5', name: 'Raita', description: 'Cool yogurt with cucumber and mint', price: 69, image: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=300&h=200&fit=crop', rating: 4.2, isVeg: true, category: 'sides' },
    ],
  },
  {
    id: '4',
    name: 'Dragon Wok',
    cuisine: ['Chinese', 'Asian', 'Noodles'],
    rating: 4.2,
    deliveryTime: '30-35 min',
    distance: '1.8 km',
    costForTwo: 450,
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=300&fit=crop',
    address: '321 Dragon Lane, Chinatown',
    openTime: '12:00 PM',
    closeTime: '10:30 PM',
    menu: [
      { id: '4-1', name: 'Hakka Noodles', description: 'Stir-fried noodles with vegetables and soy sauce', price: 199, image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&h=200&fit=crop', rating: 4.3, isVeg: true, category: 'chinese', popular: true },
      { id: '4-2', name: 'Chicken Manchurian', description: 'Crispy chicken in tangy manchurian sauce', price: 269, image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=300&h=200&fit=crop', rating: 4.4, isVeg: false, category: 'chinese', popular: true },
      { id: '4-3', name: 'Spring Rolls', description: 'Crispy vegetable spring rolls with sweet chili dip', price: 149, image: 'https://images.unsplash.com/photo-1548507200-4c986597f7ba?w=300&h=200&fit=crop', rating: 4.1, isVeg: true, category: 'chinese' },
      { id: '4-4', name: 'Fried Rice', description: 'Wok-tossed rice with vegetables and egg', price: 179, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&h=200&fit=crop', rating: 4.2, isVeg: false, category: 'chinese' },
    ],
  },
  {
    id: '5',
    name: 'Sweet Tooth Bakery',
    cuisine: ['Desserts', 'Bakery', 'Cafe'],
    rating: 4.7,
    deliveryTime: '15-20 min',
    distance: '0.5 km',
    costForTwo: 350,
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop',
    offer: 'Buy 2 Get 1 Free',
    isVeg: true,
    address: '55 Sweet Lane, Garden District',
    openTime: '9:00 AM',
    closeTime: '9:00 PM',
    menu: [
      { id: '5-1', name: 'Chocolate Truffle Cake', description: 'Rich dark chocolate cake with ganache frosting', price: 349, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&h=200&fit=crop', rating: 4.8, isVeg: true, category: 'desserts', popular: true },
      { id: '5-2', name: 'Red Velvet Cupcake', description: 'Moist red velvet with cream cheese frosting', price: 129, image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?w=300&h=200&fit=crop', rating: 4.6, isVeg: true, category: 'desserts' },
      { id: '5-3', name: 'Blueberry Cheesecake', description: 'New York style cheesecake with fresh blueberry compote', price: 299, image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&h=200&fit=crop', rating: 4.7, isVeg: true, category: 'desserts', popular: true },
      { id: '5-4', name: 'Cappuccino', description: 'Double-shot espresso with steamed milk foam', price: 149, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300&h=200&fit=crop', rating: 4.5, isVeg: true, category: 'coffee' },
    ],
  },
  {
    id: '6',
    name: 'Green Bowl',
    cuisine: ['Healthy', 'Salads', 'Bowls'],
    rating: 4.4,
    deliveryTime: '20-25 min',
    distance: '1.0 km',
    costForTwo: 500,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
    offer: '15% OFF',
    isVeg: true,
    address: '88 Wellness Blvd, Health District',
    openTime: '8:00 AM',
    closeTime: '9:00 PM',
    menu: [
      { id: '6-1', name: 'Quinoa Power Bowl', description: 'Quinoa, roasted veggies, avocado, tahini dressing', price: 349, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=200&fit=crop', rating: 4.5, isVeg: true, category: 'healthy', popular: true },
      { id: '6-2', name: 'Acai Smoothie Bowl', description: 'Blended acai with granola, banana, and berries', price: 299, image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=300&h=200&fit=crop', rating: 4.6, isVeg: true, category: 'healthy', popular: true },
      { id: '6-3', name: 'Caesar Salad', description: 'Romaine lettuce, parmesan, croutons, caesar dressing', price: 249, image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=300&h=200&fit=crop', rating: 4.3, isVeg: true, category: 'healthy' },
      { id: '6-4', name: 'Green Detox Juice', description: 'Spinach, cucumber, apple, ginger, lemon', price: 179, image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=300&h=200&fit=crop', rating: 4.4, isVeg: true, category: 'healthy' },
    ],
  },
];

export const offers = [
  { id: '1', title: '30% OFF', subtitle: 'On your first order', code: 'FIRST30', color: '#FF4B3A' },
  { id: '2', title: 'FREE Delivery', subtitle: 'On orders above $200', code: 'FREEDEL', color: '#22C55E' },
  { id: '3', title: '20% OFF', subtitle: 'Use code RUSH20', code: 'RUSH20', color: '#6366F1' },
];
