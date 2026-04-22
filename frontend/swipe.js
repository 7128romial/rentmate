const swipeContainer = document.getElementById('swipe-container');

const prefs = JSON.parse(localStorage.getItem('rentmate_prefs')) || {
  city: "תל אביב",
  budget: "4500",
  type: "לבד",
  extras: ""
};

let basePrice = 4500;
// Extract number from budget string like "3000-4000" or "4k"
const numMatch = prefs.budget.match(/\d+/);
if (numMatch) {
  basePrice = parseInt(numMatch[0]);
  if (basePrice < 100) basePrice *= 1000; // handle "4" -> 4000
}

const cleanCity = prefs.city.length > 20 ? "העיר המבוקשת" : prefs.city;

const PROPERTIES = [
  {
    id: 1,
    title: `סטודיו מואר ב${cleanCity}`,
    price: `₪${basePrice.toLocaleString()}/חודש`,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
    matchScore: 98,
    tags: ["שקט", prefs.extras ? "ידידותי לבקשות" : "משופצת"]
  },
  {
    id: 2,
    title: `דירה מהממת ב${cleanCity}`,
    price: `₪${(basePrice + 350).toLocaleString()}/חודש`,
    image: "https://images.unsplash.com/photo-1502672260266-1c1de2d93688?auto=format&fit=crop&w=600&q=80",
    matchScore: 88,
    tags: [prefs.type, "מרווחת"]
  },
  {
    id: 3,
    title: `פנטהאוז באזור ${cleanCity}`,
    price: `₪${(basePrice + 1200).toLocaleString()}/חודש`,
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80",
    matchScore: 82,
    tags: ["פרימיום", "מרפסת"]
  }
];

function createCard(property) {
  const card = document.createElement('div');
  card.classList.add('swipe-card');
  card.style.backgroundImage = `url('${property.image}')`;
  
  const gradient = document.createElement('div');
  gradient.classList.add('card-gradient');
  
  const info = document.createElement('div');
  info.classList.add('card-info');
  
  const matchBadge = document.createElement('div');
  matchBadge.classList.add('match-badge');
  matchBadge.textContent = `התאמה של ${property.matchScore}%`;
  
  const title = document.createElement('h3');
  title.textContent = property.title;
  
  const price = document.createElement('p');
  price.classList.add('card-price');
  price.textContent = property.price;
  
  const tagsContainer = document.createElement('div');
  tagsContainer.classList.add('card-tags');
  property.tags.forEach(tag => {
    const span = document.createElement('span');
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });
  
  info.appendChild(matchBadge);
  info.appendChild(title);
  info.appendChild(price);
  info.appendChild(tagsContainer);
  
  card.appendChild(gradient);
  card.appendChild(info);
  
  return card;
}

function initCards() {
  PROPERTIES.reverse().forEach(prop => {
    const card = createCard(prop);
    swipeContainer.appendChild(card);
    
    const hammer = new Hammer(card);
    
    hammer.on('pan', (ev) => {
      if (ev.deltaX === 0) return;
      if (ev.center.x === 0 && ev.center.y === 0) return;
      
      const rotate = ev.deltaX * 0.05;
      card.style.transform = `translate(${ev.deltaX}px, ${ev.deltaY}px) rotate(${rotate}deg)`;
    });
    
    hammer.on('panend', (ev) => {
      const keep = Math.abs(ev.deltaX) < 80;
      card.classList.toggle('removed', !keep);
      
      if (keep) {
        card.style.transform = '';
      } else {
        const endX = Math.max(Math.abs(ev.velocity * 800), 300);
        const toX = ev.deltaX > 0 ? endX : -endX;
        const endY = Math.abs(ev.velocity * 800) || 300;
        const toY = ev.deltaY > 0 ? endY : -endY;
        const rotate = ev.deltaX * 0.03;
        
        card.style.transform = `translate(${toX}px, ${toY + ev.deltaY}px) rotate(${rotate}deg)`;
        setTimeout(() => card.remove(), 300);
        
        if (ev.deltaX > 0 && swipeContainer.children.length === 1) {
            setTimeout(() => {
                window.location.href = '/match.html';
            }, 500);
        }
      }
    });
  });
}

document.getElementById('btn-nope').addEventListener('click', () => swipeAction('left'));
document.getElementById('btn-like').addEventListener('click', () => swipeAction('right'));
document.getElementById('btn-super').addEventListener('click', () => swipeAction('up'));

function swipeAction(direction) {
    const cards = document.querySelectorAll('.swipe-card:not(.removed)');
    if (!cards.length) return;
    const topCard = cards[cards.length - 1];
    topCard.classList.add('removed');
    
    let toX = 0, toY = 0;
    if (direction === 'left') toX = -1000;
    if (direction === 'right') toX = 1000;
    if (direction === 'up') toY = -1000;
    
    topCard.style.transform = `translate(${toX}px, ${toY}px) rotate(${toX * 0.03}deg)`;
    setTimeout(() => topCard.remove(), 300);
    
    if ((direction === 'right' || direction === 'up') && cards.length === 1) {
        setTimeout(() => {
            window.location.href = '/match.html';
        }, 500);
    }
}

initCards();
