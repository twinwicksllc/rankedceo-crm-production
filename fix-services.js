const fs = require('fs');
const path = require('path');

const services = [
  'contact-service.ts',
  'company-service.ts',
  'deal-service.ts',
  'activity-service.ts',
  'campaign-service.ts',
  'form-service.ts',
  'form-validation-service.ts',
  'form-submission-service.ts',
  'email-service.ts',
];

services.forEach(serviceFile => {
  const filePath = path.join('lib/services', serviceFile);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${serviceFile} - not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update constructor
  const oldConstructor = /constructor\(\) \{\s*this\.supabase = createClient\(\);\s*\}/;
  const newConstructor = `constructor() {
    // Don't initialize client in constructor - will be lazy-loaded
    this.supabase = null as any;
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }`;
  
  if (oldConstructor.test(content)) {
    content = content.replace(oldConstructor, newConstructor);
    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated ${serviceFile}`);
  } else {
    console.log(`- ${serviceFile} already updated or different pattern`);
  }
});

console.log('Done!');