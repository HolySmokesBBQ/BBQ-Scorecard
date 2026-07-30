// Catering menu data — sides and desserts a BBQ caterer typically offers.
// Defaults are per-person quantities. Cost per person is your raw
// ingredient cost (before markup), used by the catering quote engine
// to factor sides/desserts into total cost.
//
// All defaults are tunable per quote — pitmasters cook different sides
// for different events. Wedding crowd eats more cobbler than a kid's
// graduation; church potluck eats fewer ribs because everyone's already
// brought a casserole.

export const SIDES_MENU = {
  'Baked Beans':       { default: 0.5, unit: 'cup',  costPerPerson: 1.50, ingredients: 'Beans, brown sugar, bacon, BBQ sauce, mustard' },
  'Coleslaw':          { default: 0.5, unit: 'cup',  costPerPerson: 1.25, ingredients: 'Cabbage, carrots, mayo, vinegar, sugar' },
  'Mac & Cheese':      { default: 0.75, unit: 'cup', costPerPerson: 2.00, ingredients: 'Elbow pasta, sharp cheddar, milk, butter, breadcrumbs' },
  'Cornbread':         { default: 1,   unit: 'piece', costPerPerson: 0.75, ingredients: 'Cornmeal, butter, sugar, eggs, buttermilk' },
  'Potato Salad':      { default: 0.5, unit: 'cup',  costPerPerson: 1.50, ingredients: 'Potatoes, mayo, mustard, eggs, pickles, celery' },
  'Pasta Salad':       { default: 0.5, unit: 'cup',  costPerPerson: 1.25, ingredients: 'Rotini, Italian dressing, peppers, olives, parmesan' },
  'Green Beans':       { default: 0.5, unit: 'cup',  costPerPerson: 1.25, ingredients: 'Green beans, bacon, onion, garlic' },
  'Hash Brown Casserole': { default: 0.5, unit: 'cup', costPerPerson: 1.75, ingredients: 'Hash browns, cream of chicken, cheddar, sour cream, butter' },
  'Pickles & Onions':  { default: 2,   unit: 'oz',   costPerPerson: 0.50, ingredients: 'Sliced dill pickles, sliced red onion' },
  'Rolls':             { default: 1.5, unit: 'roll', costPerPerson: 0.50, ingredients: 'Dinner rolls or slider buns, butter' },
  'BBQ Sauce':         { default: 2,   unit: 'oz',   costPerPerson: 0.40, ingredients: 'Your house sauce, served on the side' },
};

export const DESSERTS_MENU = {
  'Peach Cobbler':     { default: 1, unit: 'serving', costPerPerson: 1.75, ingredients: 'Peaches (fresh or canned), butter, sugar, biscuit topping' },
  'Banana Pudding':    { default: 1, unit: 'serving', costPerPerson: 2.00, ingredients: 'Bananas, vanilla wafers, instant pudding, whipped topping' },
  'Brownies':          { default: 1, unit: 'piece',   costPerPerson: 1.00, ingredients: 'Brownie mix or scratch (cocoa, butter, eggs, flour)' },
  'Chocolate Chip Cookies': { default: 2, unit: 'cookie', costPerPerson: 0.75, ingredients: 'Cookie dough or scratch (butter, sugar, chocolate chips, flour)' },
  'Apple Pie':         { default: 1, unit: 'slice',   costPerPerson: 1.50, ingredients: 'Apples, pie crust, cinnamon, sugar, butter' },
  'Pecan Pie':         { default: 1, unit: 'slice',   costPerPerson: 1.75, ingredients: 'Pecans, corn syrup, eggs, butter, vanilla, pie crust' },
  'Bread Pudding':     { default: 1, unit: 'serving', costPerPerson: 1.50, ingredients: 'Bread, milk, eggs, sugar, cinnamon, vanilla; bourbon sauce optional' },
  'Carrot Cake':       { default: 1, unit: 'slice',   costPerPerson: 2.00, ingredients: 'Carrots, cake mix or scratch, cream cheese frosting' },
};

// Helper: combined cost per person for a given selection of sides + desserts.
// Each selection is keyed by item name → custom { servings, costPerPerson }.
// Falls back to menu defaults if no custom override.
export function computeMenuCostPerPerson(sidesSelection, dessertsSelection) {
  let total = 0;
  for (const name of Object.keys(sidesSelection || {})) {
    const def = SIDES_MENU[name];
    const sel = sidesSelection[name];
    if (!def) continue;
    const cost = sel.costPerPerson ?? def.costPerPerson;
    total += cost;
  }
  for (const name of Object.keys(dessertsSelection || {})) {
    const def = DESSERTS_MENU[name];
    const sel = dessertsSelection[name];
    if (!def) continue;
    const cost = sel.costPerPerson ?? def.costPerPerson;
    total += cost;
  }
  return total;
}
