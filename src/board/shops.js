// BBQ Board shop directory. Every shop the app knows about, whether it
// has a price on file or not. Unpriced shops become submission CTAs —
// "we know this place exists, we just don't have prices yet."
//
// Sources (verified 2026-07-01):
//   Primary: Google Maps + each shop's official website
//   Do NOT trust Yelp regional roll-ups — Yelp's "Best butchers in
//   Waukesha" listing surfaced Dorfler's (Buffalo Grove, IL) and Tony's
//   (Grayslake, IL) as if they were in Wisconsin. Verify addresses with
//   Google Maps or the shop's own site before adding.
//
// When adding a shop:
//   - Use the real store name as it appears on the storefront
//   - `location` is the customer-facing address or "All [region] locations" for chains
//   - Chains that price the same across a metro get ONE row per region, not per store
//   - Independent butchers get their specific address
//   - `storeType` drives icon + list ordering (butchers first, chains after)
//   - Corridor towns get assigned to their nearest metro (Waukesha/Oconomowoc → MKE,
//     Watertown → Madison, based on I-94 corridor midpoint)

export const SHOPS = [
  // ─── MILWAUKEE METRO — INDEPENDENT BUTCHERS ───────────────────
  {
    id: 'bunzels_milwaukee',
    name: "Bunzel's Meat Market",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '9015 W Burleigh St, Milwaukee',
    website: 'https://bunzels.com/',
    note: 'Family-owned since 1907. Custom cuts, sausages, and beef jerky.',
  },
  {
    id: 'kettle_range_milwaukee',
    name: 'Kettle Range Meat Co.',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '5501 W State St, Milwaukee',
    website: 'https://shop.kettlerangemeats.com/',
    note: 'Whole-animal butchery, grass-fed beef, heritage pork, house sausage.',
  },
  {
    id: 'kettle_range_elm_grove',
    name: 'Kettle Range Meat Co. (Elm Grove)',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '13402 Watertown Plank Rd, Elm Grove',
    website: 'https://shop.kettlerangemeats.com/',
    note: 'Kettle Range second location. Same catalog and pricing as Milwaukee.',
  },
  {
    id: 'rays_butcher_greenfield',
    name: "Ray's Butcher Shoppe",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: 'Greenfield',
    website: 'https://www.raysbutchershoppe.com/',
    note: 'Community favorite since 1977. Hand-cut steaks and smoked specialties.',
  },
  {
    id: 'buddys_milwaukee',
    name: "Buddy's Meat Market",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '3620 S Clement Ave, Milwaukee',
    note: 'Tippecanoe neighborhood butcher.',
  },
  {
    id: 'c_and_r_milwaukee',
    name: 'C & R Market',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '3001 S 9th Pl, Milwaukee',
    website: 'https://www.candrmarketmilwaukee.com/',
    note: 'Pork specialists and Polish sausage.',
  },
  {
    id: 'usingers_milwaukee',
    name: "Usinger's",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '1030 N Old World 3rd St, Milwaukee',
    note: 'Historic Milwaukee sausage maker (est. 1880). Sausage-forward — call for primal cuts.',
  },
  {
    id: 'rupenas_west_allis',
    name: "Rupena's Fine Foods",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '7641 W Beloit Rd, West Allis',
    website: 'https://www.rupenas.com/',
    note: 'Full-service butcher, sausage, prepared foods, and cafe.',
  },
  {
    id: 'becher_meats',
    name: 'Becher Meats',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '2079 S 69th St, West Allis',
    note: 'West Allis neighborhood butcher.',
  },

  // ─── MILWAUKEE METRO CORRIDOR (Waukesha / Oconomowoc / Delafield) ──
  {
    id: 'roberts_specialty_waukesha',
    name: "Roberts' Specialty Meats",
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: 'Sunset Dr, Waukesha',
    website: 'http://robertsspecialtymeatswaukesha.com/',
    note: 'Waukesha institution. Grades of beef at fair prices.',
  },
  {
    id: 'sausage_haus_oconomowoc',
    name: 'Sausage Haus Meat & Deli',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '523 N Oakwood Ave, Oconomowoc',
    note: 'Downtown Oconomowoc butcher. Brats and sausage-forward.',
  },
  {
    id: 'daybreak_prime_delafield',
    name: 'Daybreak Prime Meats & Deli',
    storeType: 'butcher',
    region: 'milwaukee_metro',
    location: '622 N Genesee St, Delafield',
    website: 'https://daybreakprimemeats.com/',
    note: 'Prime cuts, deli, and grocery. Delafield.',
  },

  // ─── MILWAUKEE METRO — WAREHOUSE CLUBS ────────────────────────
  {
    id: 'costco_milwaukee_metro',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area warehouses',
    note: 'Whole packer briskets — Prime and Choice grades. Membership required.',
  },
  {
    id: 'sams_club_milwaukee_metro',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area clubs',
    note: 'Whole packer briskets and case-quantity pork/chicken. Membership required.',
  },

  // ─── MILWAUKEE METRO — GROCERY / SUPERMARKETS ─────────────────
  {
    id: 'walmart_milwaukee_metro',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area supercenters',
    note: 'Whole packer briskets available at meat counter — call ahead for larger cuts.',
  },
  {
    id: 'meijer_milwaukee_metro',
    name: 'Meijer',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
  },
  {
    id: 'woodmans_milwaukee_metro',
    name: "Woodman's Market",
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Wisconsin-based. Larger meat counter than most.',
  },
  {
    id: 'metro_market_milwaukee_metro',
    name: 'Metro Market',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Kroger banner. Higher-end selection.',
  },
  {
    id: 'sendiks_milwaukee_metro',
    name: "Sendik's Food Market",
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Family-owned Wisconsin grocer. Butcher counter at every location.',
  },
  {
    id: 'pick_n_save_milwaukee_metro',
    name: "Pick 'n Save",
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Kroger banner.',
  },
  {
    id: 'fresh_thyme_milwaukee_metro',
    name: 'Fresh Thyme Market',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
  },
  {
    id: 'whole_foods_milwaukee_metro',
    name: 'Whole Foods',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Premium meat counter. Grass-fed and organic options.',
  },
  {
    id: 'aldi_milwaukee_metro',
    name: 'Aldi',
    storeType: 'grocery',
    region: 'milwaukee_metro',
    location: 'All Milwaukee-area stores',
    note: 'Value-focused. Limited BBQ cuts, but ground beef and chicken quarters priced aggressively.',
  },

  // ─── MADISON METRO — INDEPENDENT BUTCHERS ─────────────────────
  {
    id: 'conscious_carnivore_madison',
    name: 'The Conscious Carnivore',
    storeType: 'butcher',
    region: 'madison_metro',
    location: 'Madison',
    website: 'https://conscious-carnivore.com/',
    note: 'Pasture-raised, hormone-free. Locally harvested Wisconsin farms.',
  },
  {
    id: 'bavaria_sausage_madison',
    name: 'Bavaria Sausage Kitchen',
    storeType: 'butcher',
    region: 'madison_metro',
    location: '6317 Nesbitt Rd, Madison',
    website: 'https://bavariasausage.com/',
    note: 'German sausage maker + butcher. Well known statewide.',
  },
  {
    id: 'kens_meats_monona',
    name: "Ken's Meats & Deli",
    storeType: 'butcher',
    region: 'madison_metro',
    location: '5725 Monona Dr, Monona',
    website: 'https://kensmeatsanddeli.com/',
    note: 'Fresh meat, deli, catering. Serves McFarland / Monona / Fitchburg.',
  },
  {
    id: 'brennans_market_madison',
    name: "Brennan's Market",
    storeType: 'butcher',
    region: 'madison_metro',
    location: '8210 Watts Rd, Madison',
    website: 'https://brennansmarket.com/',
    note: 'Family-owned specialty grocer with full butcher counter.',
  },
  {
    id: 'metcalfes_west_towne',
    name: "Metcalfe's Market (West Towne)",
    storeType: 'butcher',
    region: 'madison_metro',
    location: '7455 Mineral Point Rd, Madison',
    website: 'https://www.shopmetcalfes.com/',
    note: 'Full butcher counter. Second Madison location at Hilldale.',
  },
  {
    id: 'metcalfes_hilldale',
    name: "Metcalfe's Market (Hilldale)",
    storeType: 'butcher',
    region: 'madison_metro',
    location: '726 N Midvale Blvd, Madison',
    website: 'https://www.shopmetcalfes.com/',
    note: 'Full butcher counter. Hilldale location.',
  },
  {
    id: 'uw_provision_middleton',
    name: 'The Meat Market — UW Provision',
    storeType: 'butcher',
    region: 'madison_metro',
    location: 'Middleton',
    note: 'Retail arm of one of the Midwest’s biggest meat processors.',
  },
  {
    id: 'meat_people_madison',
    name: 'Meat People Butcher',
    storeType: 'butcher',
    region: 'madison_metro',
    location: '4106 Monona Dr, Madison',
    website: 'https://meatpeoplebutcher.com/',
    note: 'Whole-animal butcher. Grass-fed beef, pastured pork, sausage.',
  },
  {
    id: 'willy_street_coop_madison',
    name: 'Willy Street Co-op',
    storeType: 'butcher',
    region: 'madison_metro',
    location: 'Madison (East / West / North)',
    note: 'Co-op grocer with full butcher counter. Local sourcing.',
  },

  // ─── MADISON METRO — WAREHOUSE CLUBS ──────────────────────────
  {
    id: 'costco_madison_metro',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'madison_metro',
    location: 'Madison warehouse',
    note: 'Whole packer briskets — Prime and Choice grades. Membership required.',
  },
  {
    id: 'sams_club_madison_metro',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'madison_metro',
    location: 'Madison-area clubs',
    note: 'Whole packer briskets and case-quantity pork/chicken. Membership required.',
  },

  // ─── MADISON METRO — GROCERY ──────────────────────────────────
  {
    id: 'walmart_madison_metro',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'All Madison-area supercenters',
  },
  {
    id: 'woodmans_madison_metro',
    name: "Woodman's Market",
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison / Sun Prairie / Janesville',
    note: 'Wisconsin-based, employee-owned. Larger meat counter than most.',
  },
  {
    id: 'hy_vee_madison_metro',
    name: 'Hy-Vee',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison / Fitchburg',
    note: 'Full-service butcher counter at every store.',
  },
  {
    id: 'whole_foods_madison_metro',
    name: 'Whole Foods',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison',
    note: 'Grass-fed and organic focus. Higher price band.',
  },
  {
    id: 'pick_n_save_madison_metro',
    name: "Pick 'n Save",
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'All Madison-area stores',
    note: 'Kroger banner.',
  },
  {
    id: 'meijer_madison_metro',
    name: 'Meijer',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison metro',
  },
  {
    id: 'fresh_thyme_madison_metro',
    name: 'Fresh Thyme Market',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison',
  },
  {
    id: 'trader_joes_madison_metro',
    name: "Trader Joe's",
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'Madison',
    note: 'Limited BBQ cuts. Marinated tri-tip and pre-packed brisket flats.',
  },
  {
    id: 'aldi_madison_metro',
    name: 'Aldi',
    storeType: 'grocery',
    region: 'madison_metro',
    location: 'All Madison-area stores',
  },

  // ─── GREEN BAY ─────────────────────────────────────────────────
  {
    id: 'maplewood_meats_green_bay',
    name: 'Maplewood Meats',
    storeType: 'butcher',
    region: 'green_bay',
    location: '4663 Milltown Rd, Green Bay',
    note: 'Local since 1983. Fresh butchered on-site, sausages made on-site.',
  },
  {
    id: 'muellers_green_bay',
    name: "Mueller's Meat Market & Sausage Shoppe",
    storeType: 'butcher',
    region: 'green_bay',
    location: '1944 University Ave, Green Bay',
    note: 'Full-service butcher and sausage maker on Green Bay east side.',
  },
  {
    id: 'costco_green_bay',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'green_bay',
    location: 'Green Bay warehouse',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_green_bay',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'green_bay',
    location: 'Green Bay area',
    note: 'Whole packer briskets and case-quantity meats.',
  },
  {
    id: 'walmart_green_bay',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'green_bay',
    location: 'All Green Bay-area supercenters',
  },
  {
    id: 'meijer_green_bay',
    name: 'Meijer',
    storeType: 'grocery',
    region: 'green_bay',
    location: 'Green Bay area',
  },
  {
    id: 'woodmans_green_bay',
    name: "Woodman's Market",
    storeType: 'grocery',
    region: 'green_bay',
    location: 'Howard / Bellevue',
    note: 'Wisconsin-based, employee-owned. Big meat counter.',
  },
  {
    id: 'festival_foods_green_bay',
    name: 'Festival Foods',
    storeType: 'grocery',
    region: 'green_bay',
    location: 'Green Bay area',
    note: 'Wisconsin family-owned grocer with full butcher counter.',
  },

  // ─── FOX VALLEY (APPLETON / OSHKOSH) ───────────────────────────
  {
    id: 'jacobs_meat_appleton',
    name: 'Jacobs Meat Market',
    storeType: 'butcher',
    region: 'fox_valley',
    location: '544 N Lawe St, Appleton',
    website: 'https://jacobsmeatmarket.com/',
    note: 'Family-owned since 1945. German sausage specialty.',
  },
  {
    id: 'costco_appleton',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'fox_valley',
    location: 'Appleton warehouse',
  },
  {
    id: 'sams_club_appleton',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'fox_valley',
    location: 'Fox Valley clubs',
  },
  {
    id: 'walmart_fox_valley',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'fox_valley',
    location: 'All Fox Valley supercenters',
  },
  {
    id: 'festival_foods_fox_valley',
    name: 'Festival Foods',
    storeType: 'grocery',
    region: 'fox_valley',
    location: 'Fox Valley locations',
    note: 'Wisconsin family-owned grocer with full butcher counter.',
  },
  {
    id: 'woodmans_appleton',
    name: "Woodman's Market",
    storeType: 'grocery',
    region: 'fox_valley',
    location: 'Appleton',
    note: 'Wisconsin-based, employee-owned. Big meat counter.',
  },

  // ─── CHICAGO METRO ─────────────────────────────────────────────
  {
    id: 'paulina_market_chicago',
    name: 'Paulina Meat Market',
    storeType: 'butcher',
    region: 'chicago_metro',
    location: '3501 N Lincoln Ave, Chicago',
    website: 'https://www.paulinamarket.com/',
    note: 'Lakeview institution. Sausage king of Chicago, dozens of varieties.',
  },
  {
    id: 'costco_chicago',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'chicago_metro',
    location: 'All Chicagoland warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_chicago',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'chicago_metro',
    location: 'Chicagoland clubs',
  },
  {
    id: 'walmart_chicago',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'chicago_metro',
    location: 'All Chicagoland supercenters',
  },
  {
    id: 'meijer_chicago',
    name: 'Meijer',
    storeType: 'grocery',
    region: 'chicago_metro',
    location: 'Chicagoland locations',
  },
  {
    id: 'jewel_osco_chicago',
    name: 'Jewel-Osco',
    storeType: 'grocery',
    region: 'chicago_metro',
    location: 'All Chicagoland stores',
    note: 'Region\'s biggest supermarket chain. Albertsons banner.',
  },
  {
    id: 'mariano_chicago',
    name: "Mariano's",
    storeType: 'grocery',
    region: 'chicago_metro',
    location: 'Chicagoland locations',
    note: 'Kroger banner. Full butcher counter.',
  },

  // ─── KANSAS CITY METRO ─────────────────────────────────────────
  {
    id: 'local_pig_kc',
    name: 'Local Pig',
    storeType: 'butcher',
    region: 'kansas_city_metro',
    location: '20 E 5th St, Kansas City, MO (City Market)',
    website: 'https://localpig.com/',
    note: 'Whole-animal butcher, artisan meats. City Market landmark.',
  },
  {
    id: 'bichelmeyer_meats_kc',
    name: 'Bichelmeyer Meats',
    storeType: 'butcher',
    region: 'kansas_city_metro',
    location: '704 Cheyenne Ave, Kansas City, KS',
    website: 'https://bichelmeyermeatskc.com/',
    note: 'KC tradition since 1946. Old-school Cowtown butcher.',
  },
  {
    id: 'broadway_butcher_kc',
    name: 'Broadway Butcher Shop',
    storeType: 'butcher',
    region: 'kansas_city_metro',
    location: '3828 Broadway Blvd, Kansas City, MO',
    website: 'https://broadwaybutchershop.com/',
    note: 'Midtown KC butcher and local grocery.',
  },
  {
    id: 'upper_cut_kc_liberty',
    name: 'The Upper Cut KC',
    storeType: 'butcher',
    region: 'kansas_city_metro',
    location: '1177 W Kansas St, Liberty, MO',
    website: 'https://theuppercutkc.com/',
    note: 'Prime Akaushi and Angus from own farm in Richmond, MO.',
  },
  {
    id: 'costco_kc',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'kansas_city_metro',
    location: 'All KC-metro warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_kc',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'kansas_city_metro',
    location: 'KC-metro clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_kc',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'kansas_city_metro',
    location: 'All KC-area supercenters',
  },
  {
    id: 'price_chopper_kc',
    name: 'Price Chopper',
    storeType: 'grocery',
    region: 'kansas_city_metro',
    location: 'All KC-area stores',
    note: 'KC-metro grocery chain. Full butcher counter.',
  },
  {
    id: 'hy_vee_kc',
    name: 'Hy-Vee',
    storeType: 'grocery',
    region: 'kansas_city_metro',
    location: 'KC-metro locations',
    note: 'Full-service butcher counter.',
  },
  {
    id: 'aldi_kc',
    name: 'Aldi',
    storeType: 'grocery',
    region: 'kansas_city_metro',
    location: 'All KC-area stores',
  },

  // ─── AUSTIN METRO ──────────────────────────────────────────────
  {
    id: 'longhorn_meat_market',
    name: 'Longhorn Meat Market',
    storeType: 'butcher',
    region: 'austin_metro',
    location: '11600 Menchaca Rd Suite H, Austin',
    website: 'https://longhornmeatmarket.com/',
    note: 'South Austin butcher. Prime brisket, heritage pork, house-ground beef.',
  },
  {
    id: 'augustus_ranch',
    name: 'Augustus Ranch Meat Company',
    storeType: 'farm',
    region: 'austin_metro',
    location: '500 Airport Rd, Yoakum, TX 77995',
    website: 'https://augustusranch.com/',
    note: 'Pasture-finished beef ranch near Shiner, TX. Pickup at Yoakum ranch office; ships statewide.',
  },

  // ─── MEMPHIS METRO ────────────────────────────────────────────
  {
    id: 'costco_memphis',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'memphis_metro',
    location: 'All Memphis-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_memphis',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'memphis_metro',
    location: 'Memphis-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_memphis',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'memphis_metro',
    location: 'All Memphis-area supercenters',
  },
  {
    id: 'humphreys_prime_cut_shoppe',
    name: "Humphrey's Prime Cut Shoppe",
    storeType: 'butcher',
    region: 'memphis_metro',
    location: 'Memphis',
    website: 'https://humphreysmemphis.com/',
    note: "Attached to Folk's Folly steakhouse. Primarily steakhouse cuts; limited BBQ-cut selection.",
  },

  // ─── NASHVILLE METRO ──────────────────────────────────────────
  {
    id: 'porter_road',
    name: 'Porter Road',
    storeType: 'butcher',
    region: 'nashville_metro',
    location: '501 Gallatin Ave, Nashville',
    website: 'https://porterroad.com/',
    note: 'Pasture-raised, dry-aged 14+ days. Ships nationally from Princeton, KY; retail storefront in East Nashville.',
  },
  {
    id: 'hext_quality_meat',
    name: 'Hext Quality Meat',
    storeType: 'farm',
    region: 'nashville_metro',
    location: 'Nashville Farmers\' Market (Thu-Sun)',
    website: 'https://www.hextqualitymeat.com/',
    note: 'Pasture-raised, USDA-certified Nashville-area farm butcher. Sells at Nashville Farmers\' Market and via local shipping.',
  },
  {
    id: 'costco_nashville',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'nashville_metro',
    location: 'All Nashville-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_nashville',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'nashville_metro',
    location: 'Nashville-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_nashville',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'nashville_metro',
    location: 'All Nashville-area supercenters',
  },

  // ─── ST. LOUIS METRO ──────────────────────────────────────────
  {
    id: 'kern_meat_company',
    name: 'Kern Meat Company',
    storeType: 'butcher',
    region: 'st_louis_metro',
    location: 'St. Louis',
    website: 'https://kern-meat-co-inc.myshopify.com/',
    note: 'Certified Hereford Beef. Shopify store with online ordering.',
  },
  {
    id: 'costco_st_louis',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'st_louis_metro',
    location: 'All St. Louis-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_st_louis',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'st_louis_metro',
    location: 'St. Louis-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_st_louis',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'st_louis_metro',
    location: 'All St. Louis-area supercenters',
  },
  // ─── DALLAS METRO ──────────────────────────────────────────
  {
    id: 'costco_dallas',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'dallas_metro',
    location: 'All Dallas-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_dallas',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'dallas_metro',
    location: 'Dallas-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_dallas',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'dallas_metro',
    location: 'All Dallas-area supercenters',
  },

  // ─── HOUSTON METRO ────────────────────────────────────────
  {
    id: 'costco_houston',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'houston_metro',
    location: 'All Houston-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_houston',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'houston_metro',
    location: 'Houston-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_houston',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'houston_metro',
    location: 'All Houston-area supercenters',
  },

  // ─── SAN ANTONIO METRO ────────────────────────────────────
  {
    id: 'costco_san_antonio',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'san_antonio_metro',
    location: 'All San Antonio-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_san_antonio',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'san_antonio_metro',
    location: 'San Antonio-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_san_antonio',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'san_antonio_metro',
    location: 'All San Antonio-area supercenters',
  },

  // ─── BIRMINGHAM METRO ─────────────────────────────────────
  {
    id: 'costco_birmingham',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'birmingham_metro',
    location: 'All Birmingham-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_birmingham',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'birmingham_metro',
    location: 'Birmingham-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_birmingham',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'birmingham_metro',
    location: 'All Birmingham-area supercenters',
  },

  // ─── BOISE METRO ──────────────────────────────────────────
  {
    id: 'costco_boise',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'boise_metro',
    location: 'All Boise-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_boise',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'boise_metro',
    location: 'Boise-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_boise',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'boise_metro',
    location: 'All Boise-area supercenters',
  },

  // ─── LEXINGTON METRO ──────────────────────────────────────
  {
    id: 'costco_lexington',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'lexington_metro',
    location: 'All Lexington-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_lexington',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'lexington_metro',
    location: 'Lexington-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_lexington',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'lexington_metro',
    location: 'All Lexington-area supercenters',
  },

  // ─── GREENVILLE METRO ─────────────────────────────────────
  {
    id: 'costco_greenville',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'greenville_metro',
    location: 'All Greenville-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_greenville',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'greenville_metro',
    location: 'Greenville-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_greenville',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'greenville_metro',
    location: 'All Greenville-area supercenters',
  },
  // ─── OWENSBORO ─────────────────────────────────────────────
  {
    id: 'costco_owensboro',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'owensboro_metro',
    location: 'Nearest Owensboro-area warehouse',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_owensboro',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'owensboro_metro',
    location: 'Owensboro-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_owensboro',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'owensboro_metro',
    location: 'All Owensboro-area supercenters',
  },

  // ─── LOCKHART ─────────────────────────────────────────────
  {
    id: 'blues_butcher_shop',
    name: "Blue's Butcher Shop",
    storeType: 'butcher',
    region: 'lockhart_metro',
    location: 'Lockhart, TX',
    website: 'https://bluesbutchershop.com/',
    note: 'Phelan Farms wagyu butcher in the BBQ Capital of Texas. Shopify catalog.',
  },
  {
    id: 'costco_lockhart',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'lockhart_metro',
    location: 'Nearest Lockhart-area warehouse',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_lockhart',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'lockhart_metro',
    location: 'Lockhart-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_lockhart',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'lockhart_metro',
    location: 'All Lockhart-area supercenters',
  },

  // ─── ATLANTA METRO ────────────────────────────────────────
  {
    id: 'costco_atlanta',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'atlanta_metro',
    location: 'All Atlanta-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_atlanta',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'atlanta_metro',
    location: 'Atlanta-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_atlanta',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'atlanta_metro',
    location: 'All Atlanta-area supercenters',
  },

  // ─── LOUISVILLE METRO ─────────────────────────────────────
  {
    id: 'costco_louisville',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'louisville_metro',
    location: 'All Louisville-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_louisville',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'louisville_metro',
    location: 'Louisville-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_louisville',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'louisville_metro',
    location: 'All Louisville-area supercenters',
  },

  // ─── CHARLOTTE METRO ──────────────────────────────────────
  {
    id: 'costco_charlotte',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'charlotte_metro',
    location: 'All Charlotte-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_charlotte',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'charlotte_metro',
    location: 'Charlotte-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_charlotte',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'charlotte_metro',
    location: 'All Charlotte-area supercenters',
  },

  // ─── RALEIGH METRO ────────────────────────────────────────
  {
    id: 'costco_raleigh',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'raleigh_metro',
    location: 'All Raleigh-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_raleigh',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'raleigh_metro',
    location: 'Raleigh-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_raleigh',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'raleigh_metro',
    location: 'All Raleigh-area supercenters',
  },

  // ─── COLUMBIA METRO ───────────────────────────────────────
  {
    id: 'costco_columbia',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'columbia_metro',
    location: 'All Columbia-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_columbia',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'columbia_metro',
    location: 'Columbia-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_columbia',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'columbia_metro',
    location: 'All Columbia-area supercenters',
  },

  // ─── LEXINGTON NC ─────────────────────────────────────────
  {
    id: 'walmart_lexington_nc',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'lexington_nc_metro',
    location: 'Lexington, NC area supercenters',
  },

  // ─── TUSCALOOSA METRO ─────────────────────────────────────
  {
    id: 'costco_tuscaloosa',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'tuscaloosa_metro',
    location: 'Nearest Tuscaloosa-area warehouse',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_tuscaloosa',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'tuscaloosa_metro',
    location: 'Tuscaloosa-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_tuscaloosa',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'tuscaloosa_metro',
    location: 'All Tuscaloosa-area supercenters',
  },

  // ─── OKLAHOMA CITY METRO ──────────────────────────────────
  {
    id: 'costco_oklahoma_city',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'oklahoma_city_metro',
    location: 'All OKC-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_oklahoma_city',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'oklahoma_city_metro',
    location: 'OKC-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_oklahoma_city',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'oklahoma_city_metro',
    location: 'All OKC-area supercenters',
  },

  // ─── TULSA METRO ──────────────────────────────────────────
  {
    id: 'costco_tulsa',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'tulsa_metro',
    location: 'All Tulsa-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_tulsa',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'tulsa_metro',
    location: 'Tulsa-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_tulsa',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'tulsa_metro',
    location: 'All Tulsa-area supercenters',
  },

  // ══════════════════════════════════════════════════════════
  // JULY 20 SCRUB MERGE — shops surfaced by the Cowork daily
  // butcher scrub (data/pending-prices-*, Jul 13-20) plus chain
  // coverage for the 12 new metros. Addresses come from each
  // shop's own website via the scrub's sourceUrl.
  // ══════════════════════════════════════════════════════════

  // ─── AUSTIN METRO — additions (chains were missing) ───────
  {
    id: 'heb_austin',
    name: 'H-E-B',
    storeType: 'grocery',
    region: 'austin_metro',
    location: 'All Austin-area H-E-B stores',
    website: 'https://www.heb.com/',
    note: 'Dominant Texas grocer; whole untrimmed briskets are a staple SKU.',
  },
  {
    id: 'central_market_austin',
    name: 'Central Market',
    storeType: 'grocery',
    region: 'austin_metro',
    location: '4001 N Lamar Blvd, Austin',
    website: 'https://www.centralmarket.com/',
    note: 'H-E-B\'s premium banner. Natural Black Angus beef program.',
  },
  {
    id: 'costco_austin',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'austin_metro',
    location: 'All Austin-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_austin',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'austin_metro',
    location: 'Austin-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_austin',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'austin_metro',
    location: 'All Austin-area supercenters',
  },

  // ─── NASHVILLE METRO — additions ──────────────────────────
  {
    id: 'kroger_nashville',
    name: 'Kroger',
    storeType: 'grocery',
    region: 'nashville_metro',
    location: 'All Nashville-area Kroger stores',
    website: 'https://www.kroger.com/',
  },
  {
    id: 'publix_nashville',
    name: 'Publix',
    storeType: 'grocery',
    region: 'nashville_metro',
    location: 'All Nashville-area Publix stores',
    website: 'https://www.publix.com/',
  },

  // ─── MEMPHIS METRO — additions ────────────────────────────
  {
    id: 'kroger_memphis',
    name: 'Kroger',
    storeType: 'grocery',
    region: 'memphis_metro',
    location: 'All Memphis-area Kroger stores',
    website: 'https://www.kroger.com/',
  },
  {
    id: 'ramons_meat_market_memphis',
    name: "Ramon's Meat Market",
    storeType: 'butcher',
    region: 'memphis_metro',
    location: 'Memphis',
    website: 'https://www.ramonsmeatmarket.com/',
  },

  // ─── DALLAS METRO — Fort Worth additions ──────────────────
  {
    id: 'heb_fort_worth_area',
    name: 'H-E-B (Fort Worth area)',
    storeType: 'grocery',
    region: 'dallas_metro',
    location: 'Fort Worth-area H-E-B stores',
    website: 'https://www.heb.com/',
  },
  {
    id: 'wild_fork_fort_worth',
    name: 'Wild Fork Foods',
    storeType: 'grocery',
    region: 'dallas_metro',
    location: 'Fort Worth',
    website: 'https://wildforkfoods.com/',
    note: 'Frozen-first meat retailer; aggressive whole-brisket pricing.',
  },
  {
    id: 'country_meat_market_fort_worth',
    name: 'Country Meat Market',
    storeType: 'butcher',
    region: 'dallas_metro',
    location: 'E Lancaster Ave, Fort Worth',
    website: 'https://countrymeatmarket.com/',
  },
  {
    id: 'burgundys_local_fort_worth',
    name: "Burgundy's Local",
    storeType: 'farm',
    region: 'dallas_metro',
    location: 'W 7th St, Fort Worth',
    website: 'https://www.burgundypasturebeef.com/',
    note: 'Burgundy Pasture Beef\'s Fort Worth storefront. Pasture-raised, own-ranch beef and pork.',
  },

  // ─── BOISE METRO — additions ──────────────────────────────
  {
    id: 'snake_river_farms',
    name: 'Snake River Farms',
    storeType: 'farm',
    region: 'boise_metro',
    location: 'Online — ships nationally from Boise, ID',
    website: 'https://snakeriverfarms.com/',
    note: 'American Wagyu (SRF Black) and Double R Ranch USDA Choice/Prime. Ships nationally.',
  },

  // ─── LITTLE ROCK METRO ────────────────────────────────────
  {
    id: 'kroger_little_rock',
    name: 'Kroger',
    storeType: 'grocery',
    region: 'little_rock_metro',
    location: 'All Little Rock-area Kroger stores',
    website: 'https://www.kroger.com/',
  },
  {
    id: 'costco_little_rock',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'little_rock_metro',
    location: 'All Little Rock-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_little_rock',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'little_rock_metro',
    location: 'Little Rock-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_little_rock',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'little_rock_metro',
    location: 'All Little Rock-area supercenters',
  },

  // ─── NEW ORLEANS METRO ────────────────────────────────────
  {
    id: 'rouses_new_orleans',
    name: 'Rouses Markets',
    storeType: 'grocery',
    region: 'new_orleans_metro',
    location: 'All New Orleans-area Rouses Markets',
    website: 'https://www.rouses.com/',
    note: 'Gulf Coast grocer, family-owned since 1960.',
  },
  {
    id: 'winn_dixie_new_orleans',
    name: 'Winn-Dixie',
    storeType: 'grocery',
    region: 'new_orleans_metro',
    location: 'All New Orleans-area Winn-Dixie stores',
    website: 'https://www.winndixie.com/',
  },
  {
    id: 'aldi_new_orleans',
    name: 'ALDI',
    storeType: 'grocery',
    region: 'new_orleans_metro',
    location: 'All New Orleans-metro ALDI stores',
    website: 'https://www.aldi.us/',
  },
  {
    id: 'costco_new_orleans',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'new_orleans_metro',
    location: 'All New Orleans-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_new_orleans',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'new_orleans_metro',
    location: 'New Orleans-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_new_orleans',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'new_orleans_metro',
    location: 'All New Orleans-area supercenters',
  },

  // ─── SAVANNAH METRO ───────────────────────────────────────
  {
    id: 'publix_savannah',
    name: 'Publix',
    storeType: 'grocery',
    region: 'savannah_metro',
    location: 'All Savannah-area Publix stores',
    website: 'https://www.publix.com/',
  },
  {
    id: 'costco_savannah',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'savannah_metro',
    location: '6725 Waters Ave, Savannah',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_savannah',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'savannah_metro',
    location: 'Savannah-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_savannah',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'savannah_metro',
    location: 'All Savannah-area supercenters',
  },

  // ─── DENVER METRO ─────────────────────────────────────────
  {
    id: 'rugby_scott_ranch',
    name: 'Rugby Scott Ranch Provisions',
    storeType: 'farm',
    region: 'denver_metro',
    location: 'Denver metro — online ranch shop',
    website: 'https://shop.rugbyscott.com/',
    note: 'Colorado ranch selling American Wagyu direct.',
  },
  {
    id: 'costco_denver',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'denver_metro',
    location: 'All Denver-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_denver',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'denver_metro',
    location: 'Denver-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_denver',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'denver_metro',
    location: 'All Denver-area supercenters',
  },

  // ─── JACKSONVILLE METRO ───────────────────────────────────
  {
    id: 'premier_meats_jacksonville',
    name: 'Premier Meats',
    storeType: 'butcher',
    region: 'jacksonville_metro',
    location: '2401 W Beaver St, Jacksonville',
    website: 'https://premiermeatfl.com/',
    note: 'Halal butcher with full BBQ-cut counter.',
  },
  {
    id: 'costco_jacksonville',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'jacksonville_metro',
    location: 'All Jacksonville-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_jacksonville',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'jacksonville_metro',
    location: 'Jacksonville-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_jacksonville',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'jacksonville_metro',
    location: 'All Jacksonville-area supercenters',
  },

  // ─── PHOENIX METRO ────────────────────────────────────────
  {
    id: 'arcadia_meat_market_phoenix',
    name: 'Arcadia Meat Market',
    storeType: 'butcher',
    region: 'phoenix_metro',
    location: '3950 E Indian School Rd, Phoenix',
    website: 'https://www.arcadiameatmarket.com/',
    note: 'Arizona free-range grass-fed beef, Chiricahua pasture pork, Top Knot Farms chicken.',
  },
  {
    id: 'costco_phoenix',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'phoenix_metro',
    location: 'All Phoenix-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_phoenix',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'phoenix_metro',
    location: 'Phoenix-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_phoenix',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'phoenix_metro',
    location: 'All Phoenix-area supercenters',
  },

  // ─── WICHITA METRO ────────────────────────────────────────
  {
    id: 'phils_farm_butchery',
    name: "Phil's Farm & Butchery",
    storeType: 'butcher',
    region: 'wichita_metro',
    location: '1711 W Douglas Ave, Wichita (Delano)',
    website: 'https://phils.farm/',
    note: 'Farm-to-counter butcher; pasture-raised poultry and published price sheet.',
  },
  {
    id: 'dillons_wichita',
    name: 'Dillons Food Stores',
    storeType: 'grocery',
    region: 'wichita_metro',
    location: 'All Wichita-area Dillons stores',
    website: 'https://www.dillons.com/',
    note: 'Kroger\'s Kansas banner.',
  },
  {
    id: 'costco_wichita',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'wichita_metro',
    location: '9700 E Kellogg Dr, Wichita',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_wichita',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'wichita_metro',
    location: 'Wichita-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_wichita',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'wichita_metro',
    location: 'All Wichita-area supercenters',
  },

  // ─── TWIN CITIES METRO ────────────────────────────────────
  {
    id: 'kramarczuks_minneapolis',
    name: 'Kramarczuk Sausage Co.',
    storeType: 'butcher',
    region: 'twin_cities_metro',
    location: '215 E Hennepin Ave, Minneapolis',
    website: 'https://shop.kramarczuks.com/',
    note: 'Eastern European sausage maker since 1954. James Beard America\'s Classics winner.',
  },
  {
    id: 'von_hansons_twin_cities',
    name: "Von Hanson's Meats",
    storeType: 'butcher',
    region: 'twin_cities_metro',
    location: 'Multiple Twin Cities locations',
    website: 'https://shopvonhansons.com/',
    note: 'Twin Cities butcher chain known for brats.',
  },
  {
    id: 'lunds_byerlys_minneapolis',
    name: 'Lunds & Byerlys',
    storeType: 'grocery',
    region: 'twin_cities_metro',
    location: 'All Twin Cities Lunds & Byerlys stores',
    website: 'https://www.lundsandbyerlys.com/',
    note: 'Upscale Twin Cities grocer.',
  },
  {
    id: 'hyvee_twin_cities',
    name: 'Hy-Vee',
    storeType: 'grocery',
    region: 'twin_cities_metro',
    location: 'Twin Cities-area Hy-Vee stores',
    website: 'https://www.hy-vee.com/',
  },
  {
    id: 'costco_twin_cities',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'twin_cities_metro',
    location: 'All Twin Cities warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_twin_cities',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'twin_cities_metro',
    location: 'Twin Cities-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_twin_cities',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'twin_cities_metro',
    location: 'All Twin Cities-area supercenters',
  },

  // ─── OMAHA METRO ──────────────────────────────────────────
  {
    id: 'frank_stoysich_meats',
    name: 'Frank Stoysich Meats',
    storeType: 'butcher',
    region: 'omaha_metro',
    location: '5170 Q St, Omaha',
    website: 'https://www.stoysichonline.com/',
    note: 'South Omaha sausage-and-butcher institution.',
  },
  {
    id: 'rustic_cuts',
    name: 'Rustic Cuts Butcher Shop',
    storeType: 'butcher',
    region: 'omaha_metro',
    location: 'Council Bluffs, IA (~5 mi from Omaha)',
    website: 'https://rusticcutsmeat.com/',
  },
  {
    id: 'hy_vee_omaha',
    name: 'Hy-Vee',
    storeType: 'grocery',
    region: 'omaha_metro',
    location: 'All Omaha-metro Hy-Vee stores',
    website: 'https://www.hy-vee.com/',
  },
  {
    id: 'costco_omaha',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'omaha_metro',
    location: 'All Omaha-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_omaha',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'omaha_metro',
    location: 'Omaha-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_omaha',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'omaha_metro',
    location: 'All Omaha-area supercenters',
  },

  // ─── CINCINNATI METRO ─────────────────────────────────────
  {
    id: 'eckerlin_meats',
    name: 'Eckerlin Meats',
    storeType: 'butcher',
    region: 'cincinnati_metro',
    location: 'Findlay Market, 116 W Elder St, Cincinnati',
    website: 'https://shop.findlaymarket.org/',
    note: 'Sixth-generation butcher at Findlay Market, est. 1852.',
  },
  {
    id: 'country_meat_co',
    name: 'The Country Meat Co',
    storeType: 'butcher',
    region: 'cincinnati_metro',
    location: 'Findlay Market, Cincinnati',
    website: 'https://shop.findlaymarket.org/',
    note: 'Findlay Market vendor; fresh Amish chicken.',
  },
  {
    id: 'kroger_cincinnati',
    name: 'Kroger',
    storeType: 'grocery',
    region: 'cincinnati_metro',
    location: 'All Cincinnati-area Kroger stores',
    website: 'https://www.kroger.com/',
    note: 'Kroger\'s home market.',
  },
  {
    id: 'costco_cincinnati',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'cincinnati_metro',
    location: 'All Cincinnati-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_cincinnati',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'cincinnati_metro',
    location: 'Cincinnati-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_cincinnati',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'cincinnati_metro',
    location: 'All Cincinnati-area supercenters',
  },

  // ─── INDIANAPOLIS METRO ───────────────────────────────────
  {
    id: 'kincaids_meat_market',
    name: "Kincaid's Meat Market",
    storeType: 'butcher',
    region: 'indianapolis_metro',
    location: '5605 N Illinois St, Indianapolis',
    website: 'https://kincaidsmeatmarket.com/',
    note: 'North-side butcher; Gerber Farms Amish poultry.',
  },
  {
    id: 'goose_the_market',
    name: 'Goose the Market',
    storeType: 'butcher',
    region: 'indianapolis_metro',
    location: '2503 N Delaware St, Indianapolis',
    website: 'https://www.goosethemarket.com/',
    note: 'Butcher and charcuterie shop; Gunthorp Farms pork and poultry.',
  },
  {
    id: 'meijer_indianapolis',
    name: 'Meijer',
    storeType: 'grocery',
    region: 'indianapolis_metro',
    location: 'All Indianapolis-metro Meijer stores',
    website: 'https://www.meijer.com/',
  },
  {
    id: 'costco_indianapolis',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'indianapolis_metro',
    location: 'All Indianapolis-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_indianapolis',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'indianapolis_metro',
    location: 'Indianapolis-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_indianapolis',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'indianapolis_metro',
    location: 'All Indianapolis-area supercenters',
  },

  // ─── PITTSBURGH METRO ─────────────────────────────────────
  {
    id: 'weiss_meats',
    name: 'Weiss Meats',
    storeType: 'butcher',
    region: 'pittsburgh_metro',
    location: 'Pleasant Hills, Pittsburgh',
    website: 'http://www.weissmeats.com/',
    note: 'Full-line butcher with weekly sale pricing across BBQ cuts.',
  },
  {
    id: 'the_prime_butcher',
    name: 'The Prime Butcher',
    storeType: 'butcher',
    region: 'pittsburgh_metro',
    location: 'Strip District, Pittsburgh',
    website: 'https://www.theprimebutcherpgh.com/',
    note: 'USDA Choice Midwest Angus program in the Strip District market corridor.',
  },
  {
    id: 'costco_pittsburgh',
    name: 'Costco',
    storeType: 'warehouse',
    region: 'pittsburgh_metro',
    location: 'All Pittsburgh-area warehouses',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'sams_club_pittsburgh',
    name: "Sam's Club",
    storeType: 'warehouse',
    region: 'pittsburgh_metro',
    location: 'Pittsburgh-area clubs',
    note: 'Whole packer briskets. Membership required.',
  },
  {
    id: 'walmart_pittsburgh',
    name: 'Walmart Supercenter',
    storeType: 'grocery',
    region: 'pittsburgh_metro',
    location: 'All Pittsburgh-area supercenters',
  },
];

import { REGIONS, distanceMiles } from './schema.js';

// Get all shops for a region, ordered: butchers first (concept's north
// star), then warehouse, then grocery, then farm.
const TYPE_RANK = { butcher: 0, warehouse: 1, farm: 2, grocery: 3 };
export function shopsForRegion(region) {
  return SHOPS
    .filter(s => s.region === region)
    .sort((a, b) => {
      const t = (TYPE_RANK[a.storeType] ?? 99) - (TYPE_RANK[b.storeType] ?? 99);
      if (t !== 0) return t;
      return a.name.localeCompare(b.name);
    });
}

export function getShop(shopId) {
  return SHOPS.find(s => s.id === shopId);
}

// Explicit shop coordinates for the ones I could geolocate from public
// addresses. Any shop not listed here falls back to its region centroid
// via shopLatLng — accurate enough for a "within N miles" filter, since
// the fallback point is the metro downtown.
const SHOP_COORDS = {
  // Milwaukee metro — butchers with real addresses
  bunzels_milwaukee:       { lat: 43.0836, lng: -87.9994 },  // 9015 W Burleigh St
  kettle_range_milwaukee:  { lat: 43.0433, lng: -87.9871 },  // 5501 W State St
  kettle_range_elm_grove:  { lat: 43.0450, lng: -88.0900 },  // 13402 Watertown Plank Rd, Elm Grove
  rays_butcher_greenfield: { lat: 42.9614, lng: -88.0125 },  // Greenfield
  buddys_milwaukee:        { lat: 42.9955, lng: -87.9232 },  // 3620 S Clement Ave
  usingers_milwaukee:      { lat: 43.0412, lng: -87.9085 },  // 1030 N Old World 3rd St
  rupenas_west_allis:      { lat: 43.0010, lng: -88.0060 },  // 7641 W Beloit Rd
  becher_meats:            { lat: 43.0020, lng: -88.0000 },  // 2079 S 69th St, West Allis
  c_and_r_milwaukee:       { lat: 42.9732, lng: -87.9276 },  // 3001 S 9th Pl
  // Milwaukee corridor
  roberts_specialty_waukesha: { lat: 43.0080, lng: -88.2306 },
  sausage_haus_oconomowoc:    { lat: 43.1154, lng: -88.4903 },  // 523 N Oakwood Ave
  daybreak_prime_delafield:   { lat: 43.0612, lng: -88.4043 },  // 622 N Genesee St, Delafield
  // Madison metro
  conscious_carnivore_madison: { lat: 43.0731, lng: -89.4012 },
  bavaria_sausage_madison:     { lat: 42.9843, lng: -89.5030 },  // 6317 Nesbitt Rd
  kens_meats_monona:           { lat: 43.0611, lng: -89.3250 },  // 5725 Monona Dr
  meat_people_madison:         { lat: 43.0570, lng: -89.3245 },  // 4106 Monona Dr
  brennans_market_madison:     { lat: 43.0322, lng: -89.5163 },  // 8210 Watts Rd
  metcalfes_west_towne:        { lat: 43.0409, lng: -89.5029 },  // 7455 Mineral Point Rd
  metcalfes_hilldale:          { lat: 43.0790, lng: -89.4433 },  // 726 N Midvale Blvd
  uw_provision_middleton:      { lat: 43.0972, lng: -89.5040 },
  willy_street_coop_madison:   { lat: 43.0855, lng: -89.3628 },
  // Green Bay
  maplewood_meats_green_bay:   { lat: 44.5105, lng: -88.0995 },  // 4663 Milltown Rd
  muellers_green_bay:          { lat: 44.5058, lng: -87.9657 },  // 1944 University Ave
  // Fox Valley
  jacobs_meat_appleton:        { lat: 44.2678, lng: -88.4009 },  // 544 N Lawe St
  // Chicago
  paulina_market_chicago:      { lat: 41.9452, lng: -87.6723 },  // 3501 N Lincoln Ave
  // Kansas City
  local_pig_kc:                { lat: 39.1080, lng: -94.5830 },  // 20 E 5th St, City Market
  bichelmeyer_meats_kc:        { lat: 39.0894, lng: -94.6303 },  // 704 Cheyenne Ave, KC KS
  broadway_butcher_kc:         { lat: 39.0524, lng: -94.5915 },  // 3828 Broadway Blvd
  upper_cut_kc_liberty:        { lat: 39.2385, lng: -94.4182 },  // 1177 W Kansas St, Liberty
  // Austin
  longhorn_meat_market:        { lat: 30.1650, lng: -97.8280 },  // 11600 Menchaca Rd Suite H, South Austin
  augustus_ranch:               { lat: 29.2940, lng: -97.1480 },  // 500 Airport Rd, Yoakum TX (~120mi SE of Austin)
  // Memphis
  humphreys_prime_cut_shoppe:  { lat: 35.1010, lng: -89.8490 },  // Folk's Folly area, East Memphis
  // Nashville
  porter_road:                 { lat: 36.1835, lng: -86.7490 },  // 501 Gallatin Ave, East Nashville
  hext_quality_meat:           { lat: 36.1665, lng: -86.7750 },  // Nashville Farmers' Market, 900 Rosa L Parks Blvd
  // St. Louis
  kern_meat_company:           { lat: 38.6270, lng: -90.1994 },  // St. Louis
  // Lockhart
  blues_butcher_shop:          { lat: 29.8849, lng: -97.6700 },  // Lockhart, TX
  // Austin (Jul 20 merge)
  central_market_austin:       { lat: 30.3095, lng: -97.7405 },  // 4001 N Lamar Blvd
  // Fort Worth (dallas_metro — explicit coords so radius search from FW works)
  heb_fort_worth_area:         { lat: 32.7555, lng: -97.3308 },  // Fort Worth center
  wild_fork_fort_worth:        { lat: 32.6675, lng: -97.3990 },  // S Hulen St area
  country_meat_market_fort_worth: { lat: 32.7440, lng: -97.2900 }, // E Lancaster Ave
  burgundys_local_fort_worth:  { lat: 32.7510, lng: -97.3560 },  // W 7th St
  // Jacksonville
  premier_meats_jacksonville:  { lat: 30.3400, lng: -81.7050 },  // 2401 W Beaver St
  // Phoenix
  arcadia_meat_market_phoenix: { lat: 33.4950, lng: -111.9990 }, // 3950 E Indian School Rd
  // Wichita
  phils_farm_butchery:         { lat: 37.6846, lng: -97.3625 },  // 1711 W Douglas Ave, Delano
  costco_wichita:              { lat: 37.6816, lng: -97.2260 },  // 9700 E Kellogg Dr
  // Twin Cities
  kramarczuks_minneapolis:     { lat: 44.9878, lng: -93.2567 },  // 215 E Hennepin Ave
  // Omaha
  frank_stoysich_meats:        { lat: 41.2085, lng: -96.0035 },  // 5170 Q St
  rustic_cuts:                 { lat: 41.2619, lng: -95.8608 },  // Council Bluffs, IA
  // Cincinnati
  eckerlin_meats:              { lat: 39.1152, lng: -84.5190 },  // Findlay Market, 116 W Elder St
  country_meat_co:             { lat: 39.1150, lng: -84.5185 },  // Findlay Market
  // Indianapolis
  kincaids_meat_market:        { lat: 39.8580, lng: -86.1670 },  // 5605 N Illinois St
  goose_the_market:            { lat: 39.8030, lng: -86.1500 },  // 2503 N Delaware St
  // Pittsburgh
  weiss_meats:                 { lat: 40.3360, lng: -79.9600 },  // Pleasant Hills
  the_prime_butcher:           { lat: 40.4520, lng: -79.9860 },  // Strip District
  // Savannah
  costco_savannah:             { lat: 32.0100, lng: -81.1120 },  // 6725 Waters Ave
};

// Return a shop's lat/lng — its own coords if set, otherwise the region
// centroid. Used by the "city + radius" filter and the OCR review flow.
export function shopLatLng(shop) {
  const explicit = SHOP_COORDS[shop.id];
  if (explicit) return explicit;
  const r = REGIONS[shop.region];
  return r ? { lat: r.lat, lng: r.lng } : null;
}

// Return shops within `radius` miles of a lat/lng, sorted by shop type
// then name. Chains without explicit coords use their region centroid,
// so a "Milwaukee + 25 mi" search still catches "All Milwaukee-area
// Costco warehouses."
export function shopsNear({ lat, lng }, radius) {
  const rows = SHOPS
    .map(shop => {
      const p = shopLatLng(shop);
      if (!p) return null;
      const d = distanceMiles({ lat, lng }, p);
      return d <= radius ? { shop, distance: d } : null;
    })
    .filter(Boolean);
  return rows.sort((a, b) => {
    const t = (TYPE_RANK[a.shop.storeType] ?? 99) - (TYPE_RANK[b.shop.storeType] ?? 99);
    if (t !== 0) return t;
    return a.shop.name.localeCompare(b.shop.name);
  });
}
