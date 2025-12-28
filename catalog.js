export const catalog = [
    // Nebulae
    { id: "M1", name: "Crab Nebula", type: "Supernova Remnant", "const": "Taurus", mag: 8.4, size: 6.0, ra: 83.6331, dec: 22.0145 },
    { id: "M8", name: "Lagoon Nebula", type: "Nebula", "const": "Sagittarius", mag: 6.0, size: 90.0, ra: 270.9042, dec: -24.3867 },
    { id: "M16", name: "Eagle Nebula", type: "Nebula", "const": "Serpens", mag: 6.0, size: 7.0, ra: 274.7000, dec: -13.7150 },
    { id: "M17", name: "Omega Nebula", type: "Nebula", "const": "Sagittarius", mag: 6.0, size: 11.0, ra: 275.1960, dec: -16.1720 },
    { id: "M20", name: "Trifid Nebula", type: "Nebula", "const": "Sagittarius", mag: 6.3, size: 28.0, ra: 270.6300, dec: -23.0320 },
    { id: "M27", name: "Dumbbell Nebula", type: "Planetary Nebula", "const": "Vulpecula", mag: 7.4, size: 8.0, ra: 299.9010, dec: 22.7210 },
    { id: "M42", name: "Orion Nebula", type: "Nebula", "const": "Orion", mag: 4.0, size: 85.0, ra: 83.8221, dec: -5.3911 },
    { id: "M43", name: "De Mairan's Nebula", type: "Nebula", "const": "Orion", mag: 9.0, size: 20.0, ra: 84.0720, dec: -5.2750 },
    { id: "M57", name: "Ring Nebula", type: "Planetary Nebula", "const": "Lyra", mag: 8.8, size: 1.4, ra: 283.3960, dec: 33.0290 },
    { id: "M78", name: "Casper the Ghost", type: "Reflection Nebula", "const": "Orion", mag: 8.3, size: 8.0, ra: 86.6830, dec: 0.0770 },
    { id: "M97", name: "Owl Nebula", type: "Planetary Nebula", "const": "Ursa Major", mag: 9.9, size: 3.4, ra: 168.7000, dec: 55.0170 },
    { id: "NGC 1499", name: "California Nebula", type: "Nebula", "const": "Perseus", mag: 6.0, size: 145.0, ra: 60.9170, dec: 36.3670 },
    { id: "NGC 2237", name: "Rosette Nebula", type: "Nebula", "const": "Monoceros", mag: 9.0, size: 80.0, ra: 97.9170, dec: 4.9670 },
    { id: "NGC 7000", name: "North America Nebula", type: "Nebula", "const": "Cygnus", mag: 4.0, size: 120.0, ra: 314.7080, dec: 44.3330 },
    { id: "IC 434", name: "Horsehead Nebula", type: "Nebula", "const": "Orion", mag: 7.3, size: 60.0, ra: 85.2500, dec: -2.4670 },

    // Galaxies
    { id: "M31", name: "Andromeda Galaxy", type: "Galaxy", "const": "Andromeda", mag: 3.44, size: 190.0, ra: 10.6846, dec: 41.2692 },
    { id: "M33", name: "Triangulum Galaxy", type: "Galaxy", "const": "Triangulum", mag: 5.7, size: 70.0, ra: 23.4620, dec: 30.6600 },
    { id: "M51", name: "Whirlpool Galaxy", type: "Galaxy", "const": "Canes Venatici", mag: 8.4, size: 11.0, ra: 202.4690, dec: 47.1950 },
    { id: "M63", name: "Sunflower Galaxy", type: "Galaxy", "const": "Canes Venatici", mag: 8.6, size: 12.0, ra: 198.9550, dec: 42.0290 },
    { id: "M81", name: "Bode's Galaxy", type: "Galaxy", "const": "Ursa Major", mag: 6.9, size: 26.0, ra: 148.8880, dec: 69.0650 },
    { id: "M82", name: "Cigar Galaxy", type: "Galaxy", "const": "Ursa Major", mag: 8.4, size: 11.0, ra: 148.9680, dec: 69.6790 },
    { id: "M101", name: "Pinwheel Galaxy", type: "Galaxy", "const": "Ursa Major", mag: 7.9, size: 28.0, ra: 210.8020, dec: 54.3490 },
    { id: "M104", name: "Sombrero Galaxy", type: "Galaxy", "const": "Virgo", mag: 8.0, size: 9.0, ra: 189.9970, dec: -11.6230 },

    // Clusters
    { id: "M13", name: "Hercules Cluster", type: "Globular Cluster", "const": "Hercules", mag: 5.8, size: 20.0, ra: 250.4218, dec: 36.4599 },
    { id: "M3", name: "M3 Cluster", type: "Globular Cluster", "const": "Canes Venatici", mag: 6.2, size: 18.0, ra: 205.5480, dec: 28.3770 },
    { id: "M5", name: "Rose Cluster", type: "Globular Cluster", "const": "Serpens", mag: 5.6, size: 23.0, ra: 229.6380, dec: 2.0810 },
    { id: "M22", name: "Sagittarius Cluster", type: "Globular Cluster", "const": "Sagittarius", mag: 5.1, size: 32.0, ra: 279.1000, dec: -23.9050 },
    { id: "M45", name: "Pleiades", type: "Open Cluster", "const": "Taurus", mag: 1.6, size: 110.0, ra: 56.8500, dec: 24.1167 },
    { id: "M44", name: "Beehive Cluster", type: "Open Cluster", "const": "Cancer", mag: 3.7, size: 95.0, ra: 130.1000, dec: 19.9830 },
    { id: "M6", name: "Butterfly Cluster", type: "Open Cluster", "const": "Scorpius", mag: 4.2, size: 25.0, ra: 265.1000, dec: -32.2200 },
    { id: "M7", name: "Ptolemy's Cluster", type: "Open Cluster", "const": "Scorpius", mag: 3.3, size: 80.0, ra: 268.4630, dec: -34.7920 },

    // Other
    { id: "Double Cluster", name: "NGC 869/884", type: "Open Cluster", "const": "Perseus", mag: 3.7, size: 60.0, ra: 34.7500, dec: 57.1500 }
];
