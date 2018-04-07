import { JSDOM } from 'jsdom';
import request from 'request';

import logger from './log';

const menuUrl = 'http://www.ravintolafactory.com/aleksi/lounas/';
const weekdays = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
const allergens = ['(L+G)', '(M+G)', '(L)', '(L+VS)', '(M+G+VS+VE)'];
const userAllergens = 'L';

const parseAleksiMenu = (html) => {
  const dayIndex = new Date().getDay() - 1;
  if (dayIndex < 0 || dayIndex >= weekdays.length) {
    return 'Lunch available only weekdays!';
  }

  // Parse menu text
  const jsdom = new JSDOM(html);
  const cssSelector = '.content-page';
  const menu = jsdom.window.document.querySelector(cssSelector).textContent;

  // Find correct substring from menu
  const startIndex = menu.indexOf(weekdays[dayIndex]);
  const endIndex = dayIndex < weekdays.length - 1
    ? menu.indexOf(weekdays[dayIndex + 1])
    : menu.indexOf('Lauantailounas');
  if (startIndex >= 0 && startIndex < endIndex) {
    const linesString = menu.substring(startIndex, endIndex);
    const lineString = parseMenuAllergens(linesString);
    const lines = lineString.split('\n');

    // Format output
    return [`<${menuUrl}|${lines[0]}>`, ...lines.slice(1, lines.length)].join('\n');
  }

  return 'Error fetching Aleksi lunch information';
};

const parseMenuAllergens = (text) => {
  var linesText = text.split(')');
  var outputText = '';

  for(var ii = 0, len = linesText.length; ii < len; ii++) {
    var currentLine = linesText[ii];
    if(ii != len - 1){
      currentLine += ')';
    }

    if(currentLine.includes(userAllergens))
    {
      outputText += currentLine + '\n';
    }
  }

  logger.info('-Allergens:' + outputText);
  return outputText;
};

const fetchAleksiMenu = async (url = menuUrl) => new Promise((resolve) => {
  request(
    url,
    (error, { statusCode }, html) => {
      if (!error && statusCode === 200) {
        return resolve(parseAleksiMenu(html));
      }
      const errorMsg = `Failed fetching Aleksi menu: ${statusCode}`;
      logger.error(errorMsg);
      return resolve(errorMsg);
    },
  );
});

(async () => {
  logger.info('Fetching Aleksi menu for today...');
  const text = await fetchAleksiMenu();
  logger.info(`Result:\n${text}`);
  const payload = { text };
  request({
    uri: process.env.SLACK_WEBHOOK,
    method: 'POST',
    json: payload,
  }, () => logger.info('Posted menu to slack!'));
})();
