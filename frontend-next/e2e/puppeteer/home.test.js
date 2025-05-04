const puppeteer = require('puppeteer');

describe('Strona główna', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('powinno załadować stronę główną', async () => {
    await page.goto('http://localhost:3000');
    
    // Sprawdź czy strona załadowała się poprawnie
    await page.waitForSelector('h1');
    
    // Sprawdź czy tytuł strony zawiera AnyDataNext
    const title = await page.title();
    expect(title).toContain('AnyDataNext');
    
    // Sprawdź czy na stronie głównej jest przycisk do uploadu
    const linkText = await page.$eval('a[href="/upload"]', el => el.textContent);
    expect(linkText).toBeTruthy();
  }, 30000);

  test('powinno nawigować do strony upload', async () => {
    await page.goto('http://localhost:3000');
    
    // Kliknij link do strony upload
    await Promise.all([
      page.waitForNavigation(),
      page.click('a[href="/upload"]')
    ]);
    
    // Sprawdź czy URL się zmienił
    const url = page.url();
    expect(url).toContain('/upload');
    
    // Sprawdź czy komponent do uploadu plików jest widoczny
    const uploadComponent = await page.$('input[type="file"]');
    expect(uploadComponent).toBeTruthy();
  }, 30000);
});