# Phase 10: Form Builder - Implementation Plan

## Overview
Phase 10 will implement a comprehensive form builder system that allows users to create, manage, and publish custom forms for data collection. These forms can be embedded on websites or shared via public URLs to capture leads, feedback, and other information.

## Features to Build

### 1. Database Schema
- `forms` table - Stores form definitions and settings
- `form_fields` table - Stores individual form fields
- `form_submissions` table - Stores form submission data
- RLS policies for security
- Indexes for performance

### 2. Form Field Types
- Text input (single line)
- Textarea (multi-line)
- Number input
- Email input
- Phone input
- URL input
- Date picker
- Time picker
- Date/Time picker
- Select dropdown (single select)
- Multi-select (checkboxes)
- Radio buttons
- Checkbox group
- File upload
- Rating scale
- Yes/No toggle
- Hidden field
- Paragraph/Description text

### 3. Form Builder UI
- Drag-and-drop form builder interface
- Field library sidebar
- Form canvas area
- Field properties panel
- Preview mode
- Real-time validation preview

### 4. Form Validation
- Required fields
- Min/Max length
- Min/Max values
- Pattern matching (regex)
- Email format validation
- Custom validation messages

### 5. Form Management Pages
- Forms list page with statistics
- Create new form page
- Edit form page
- Form preview page
- Form settings page

### 6. Form Submission Handling
- Public form URLs
- Form submission API endpoint
- Data validation
- Spam protection (reCAPTCHA)
- Submission confirmation
- Email notifications (optional)

### 7. Form Data Management
- View submissions page
- Export submissions (CSV, JSON)
- Delete submissions
- Search and filter submissions
- Submission statistics

### 8. Form Embedding
- Embed code generator
- Responsive embed
- Custom styling options
- White-label options

## Technical Implementation

### Database Tables

#### Forms Table
```sql
- id (UUID, primary key)
- account_id (UUID, foreign key)
- name (TEXT)
- description (TEXT)
- status (TEXT: draft, published, archived)
- public_url (TEXT, unique)
- thank_you_message (TEXT)
- submit_button_text (TEXT)
- submit_button_color (TEXT)
- background_color (TEXT)
- allow_multiple_submissions (BOOLEAN)
- collect_email (BOOLEAN)
- send_notification_email (BOOLEAN)
- notification_emails (TEXT[])
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### Form Fields Table
```sql
- id (UUID, primary key)
- form_id (UUID, foreign key)
- field_type (TEXT)
- field_label (TEXT)
- field_key (TEXT, unique per form)
- placeholder (TEXT)
- default_value (TEXT)
- required (BOOLEAN)
- options (JSONB) - for select, radio, checkbox
- validation_rules (JSONB)
- order_index (INTEGER)
- width (TEXT: full, half, third, quarter)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### Form Submissions Table
```sql
- id (UUID, primary key)
- form_id (UUID, foreign key)
- submission_data (JSONB)
- submitted_at (TIMESTAMP)
- ip_address (TEXT)
- user_agent (TEXT)
- referrer (TEXT)
- contact_id (UUID, nullable)
```

### TypeScript Types
- Form, FormField, FormSubmission
- FormFieldTypes, FieldOptions
- ValidationRules, ValidationType
- CreateFormInput, UpdateFormInput
- FormStats

### Service Layer
- FormService - CRUD operations
- FormValidationService - Validate form data
- FormSubmissionService - Handle submissions
- FormEmbedService - Generate embed code

### UI Components
- FormBuilder - Main builder interface
- FormFieldEditor - Edit individual fields
- FormPreview - Preview form
- FormEmbedCode - Show embed code
- SubmissionList - Show submissions
- SubmissionDetail - View single submission

### Pages
- `/forms` - Forms list
- `/forms/new` - Create form
- `/forms/[id]` - Form details
- `/forms/[id]/edit` - Edit form
- `/forms/[id]/preview` - Preview form
- `/forms/[id]/submissions` - View submissions
- `/forms/[id]/embed` - Get embed code

### API Routes
- `/api/forms` - CRUD operations
- `/api/forms/[id]` - Single form operations
- `/api/forms/[id]/submit` - Submit form
- `/api/forms/[id]/submissions` - Get submissions
- `/api/forms/[id]/export` - Export submissions

## Implementation Order

1. **Database Setup** (Priority 1)
   - Create migration file
   - Set up tables and indexes
   - Create RLS policies

2. **Core Types & Validation** (Priority 1)
   - Define TypeScript types
   - Create validation schemas
   - Define field types and options

3. **Service Layer** (Priority 2)
   - FormService implementation
   - FormValidationService
   - FormSubmissionService

4. **API Endpoints** (Priority 2)
   - Forms CRUD endpoints
   - Form submission endpoint
   - Submissions management endpoints

5. **UI Components** (Priority 3)
   - FormBuilder component
   - FormFieldEditor component
   - FormPreview component
   - FormEmbedCode component

6. **Pages** (Priority 3)
   - Forms list page
   - Create/Edit form pages
   - Submissions management pages
   - Embed code page

7. **Integration** (Priority 4)
   - Add to navigation
   - Update layout
   - Test end-to-end

## Success Criteria

✅ Users can create forms with multiple field types
✅ Forms can be published with public URLs
✅ Forms can be embedded on external websites
✅ Form submissions are captured and stored
✅ Users can view and manage submissions
✅ Forms can be exported to CSV/JSON
✅ Real-time form preview
✅ Form validation works correctly
✅ Build compiles without errors
✅ All features are fully functional

## Estimated Time
- Database: 30 minutes
- Types & Validation: 20 minutes
- Services: 40 minutes
- APIs: 30 minutes
- UI Components: 60 minutes
- Pages: 40 minutes
- Testing & Integration: 30 minutes

**Total Estimated Time**: ~3.5 hours
