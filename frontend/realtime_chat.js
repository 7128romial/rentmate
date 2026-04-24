const form = document.querySelector('.chat-input-area');
const input = document.getElementById('chat-input');
const messages = document.getElementById('realtime-messages');

function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  appendUserMessage(value);
  input.value = '';
});
