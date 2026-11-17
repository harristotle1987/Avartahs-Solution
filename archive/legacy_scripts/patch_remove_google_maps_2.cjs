const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace Google Maps fallback block in locate endpoint
const googleMapsRegex2 = /\s*\/\/ 1\. If we have Google Maps key, use Places API \(New\) for richer data\s*if \(process\.env\.GOOGLE_MAPS_PLATFORM_KEY[\s\S]*?\/\/ 2\. Try APILayer \(Positionstack\)/;

if (googleMapsRegex2.test(code)) {
    code = code.replace(googleMapsRegex2, '\n      // 2. Try APILayer (Positionstack)');
    fs.writeFileSync('server.ts', code);
    console.log("Removed second Google Maps API block");
} else {
    console.log("Could not find second Google Maps API block");
}
