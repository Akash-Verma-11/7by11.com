'use strict';

function renderCategoryDiscovery() {
  if (typeof view === 'undefined' || view !== 'shop') return;

  const main = document.querySelector('#main');
  const collection = document.querySelector('#collection');

  if (!main || !collection ||
      document.querySelector('#category-discovery')) return;

  const section = document.createElement('section');
  section.id = 'category-discovery';
  section.className = 'category-discovery';

  const heading = document.createElement('h2');
  heading.textContent = 'Shop by category';
  section.append(heading);

  const grid = document.createElement('div');
  grid.className = 'category-grid';

  const categories = [
    ['Electronics', '🎧', 'Devices and everyday tech'],
    ['Fashion', '👕', 'Style for every occasion'],
    ['Home', '🏠', 'Essentials for your space']
  ];

  for (const [name, symbol, description] of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-tile';

    const icon = document.createElement('span');
    icon.className = 'symbol';
    icon.textContent = symbol;

    const title = document.createElement('strong');
    title.textContent = name;

    const subtitle = document.createElement('small');
    subtitle.textContent = description;

    button.append(icon, title, subtitle);

    button.addEventListener('click', () => {
      category = name;
      page = 1;
      go('shop');
    });

    grid.append(button);
  }

  section.append(grid);
  collection.before(section);
}

document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('#main');
  if (!main) return;

  const observer = new MutationObserver(() => {
    if (document.querySelector('#collection')) {
      renderCategoryDiscovery();
    }
  });

  observer.observe(main, {childList: true});

  renderCategoryDiscovery();
});
