import sys, re

# UPDATE STYLE.CSS
with open('frontend/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace the feature-icon block
css = re.sub(
    r'\.feature-icon \{[\s\S]*?\}\s*\.feature-icon svg \{[\s\S]*?\}\s*\.feature-icon\.icon-renter \{[\s\S]*?\}\s*\.feature-icon\.icon-roommate \{[\s\S]*?\}\s*\.feature-icon\.icon-landlord \{[\s\S]*?\}',
    '''.feature-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.8), 0 8px 24px rgba(0,0,0,0.04);
}
.feature-icon::after {
  display: none;
}
.feature-icon svg {
  width: 32px;
  height: 32px;
  stroke-width: 1.5;
}
.feature-icon.icon-renter {
  background: linear-gradient(135deg, rgba(255,56,92,0.15) 0%, rgba(230,30,77,0.05) 100%);
  color: #E61E4D;
}
.feature-icon.icon-renter svg {
  filter: drop-shadow(0 4px 8px rgba(230,30,77,0.3));
}
.feature-icon.icon-roommate {
  background: linear-gradient(135deg, rgba(0,198,137,0.15) 0%, rgba(0,163,122,0.05) 100%);
  color: #00A37A;
}
.feature-icon.icon-roommate svg {
  filter: drop-shadow(0 4px 8px rgba(0,163,122,0.3));
}
.feature-icon.icon-landlord {
  background: linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(85,70,201,0.05) 100%);
  color: #5546C9;
}
.feature-icon.icon-landlord svg {
  filter: drop-shadow(0 4px 8px rgba(85,70,201,0.3));
}''', css)

with open('frontend/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

# UPDATE WELCOME.HTML
with open('frontend/welcome.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('stroke-width="2"', 'stroke-width="1.5"')

with open('frontend/welcome.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Icons Updated successfully.')
