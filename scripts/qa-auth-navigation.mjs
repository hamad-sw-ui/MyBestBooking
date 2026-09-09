export default async function run(page) {
  const result = {};
  await page.goto('http://localhost:3000/');
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await page.waitForLoadState('domcontentloaded');
  result.loginFromHome = page.url();

  await page.goto('http://localhost:3000/');
  await page.getByRole('link', { name: "S'inscrire" }).click();
  await page.waitForLoadState('domcontentloaded');
  result.registerFromHome = page.url();

  await page.goto('http://localhost:3000/connexion');
  await page.getByRole('button', { name: /Client customer@mybestbooking.com/ }).click();
  await page.waitForTimeout(500);
  result.demoLoginDestination = page.url();

  await page.goto('http://localhost:3000/connexion');
  result.loginWhileAuthenticated = page.url();
  await page.goto('http://localhost:3000/inscription');
  result.registerWhileAuthenticated = page.url();
  return result;
}
