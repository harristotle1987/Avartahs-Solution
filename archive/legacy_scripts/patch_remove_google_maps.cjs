const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace Google Maps fallback block
const googleMapsRegex = /\s*\/\/ 1\. Try Google Places API \(New\) if key is present - Best accuracy\s*if \(process\.env\.GOOGLE_MAPS_PLATFORM_KEY[\s\S]*?\/\/ 2\. Try APILayer \(Positionstack\)/;

if (googleMapsRegex.test(code)) {
    code = code.replace(googleMapsRegex, '\n      // 2. Try APILayer (Positionstack)');
    fs.writeFileSync('server.ts', code);
    console.log("Removed Google Maps API block");
} else {
    console.log("Could not find Google Maps API block");
}
