import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    const h1 = await page.evaluate(() => {
      return document.querySelector('h1')?.innerText;
    });
    console.log('H1:', h1);
    
    const err = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      return pre ? pre.innerText : null;
    });
    console.log('PRE:', err);
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();
