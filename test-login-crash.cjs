const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Inject an error catcher before navigation
        await page.evaluateOnNewDocument(() => {
            window.addEventListener('error', (e) => {
                document.body.innerHTML = '<h1 style="color:red;z-index:9999;position:fixed;top:0;left:0;background:white;">ERROR: ' + e.message + '<br>' + e.error?.stack + '</h1>';
            });
            window.addEventListener('unhandledrejection', (e) => {
                document.body.innerHTML = '<h1 style="color:red;z-index:9999;position:fixed;top:0;left:0;background:white;">PROMISE ERROR: ' + e.reason + '</h1>';
            });
            
            // Overwrite console.error
            const oldErr = console.error;
            console.error = function(...args) {
                document.body.innerHTML += '<h1 style="color:orange;z-index:9999;position:fixed;bottom:0;left:0;background:white;">CONSOLE ERR: ' + args.join(' ') + '</h1>';
                oldErr(...args);
            };
        });

        await page.goto('http://localhost:4173', { waitUntil: 'load', timeout: 30000 });
        
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const loginBtn = btns.find(b => b.innerHTML.includes('User') || b.getAttribute('aria-label') === 'تسجيل الدخول');
            if (loginBtn) {
                loginBtn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            console.log('Clicked login button!');
            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: 'crash.png' });
            console.log('Took screenshot crash.png');
        }

        await browser.close();
    } catch(e) {
        console.error('Script Error:', e);
        process.exit(1);
    }
})();
