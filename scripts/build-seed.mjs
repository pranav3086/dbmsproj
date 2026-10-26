// Generates database/seed.sql (MySQL) — synthetic, clearly-labelled reference data for development
// and demonstrations. Every doctor here is FICTIONAL. Run: npm run db:seed:build
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const uuid = (key) => {
  const h = createHash('sha1').update('a10:' + key).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const arr = (xs) => `JSON_ARRAY(${xs.map(q).join(', ')})`
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const settings = [
  ['hospital_name', 'A10 Hospital', 'Brand name', true],
  ['timezone', 'Asia/Kolkata', 'IANA time zone used for all appointment times', true],
  ['timezone_offset', '+05:30', 'UTC offset of the hospital time zone, used by the database (no daylight saving in India)', false],
  ['currency', 'INR', 'ISO currency code', true],
  ['contact_phone', '+91 00000 00000', 'PLACEHOLDER — replace with the verified main line', true],
  ['contact_email', 'care@a10hospital.example', 'PLACEHOLDER — replace with the verified enquiries address', true],
  ['emergency_phone', '112', 'National emergency number (India). Confirm for your region.', true],
  ['address', 'Address to be confirmed', 'PLACEHOLDER — no verified location configured', true],
  ['opening_hours', 'Outpatient clinics: Mon–Sat, 9:00 AM – 6:00 PM (sample hours)', 'PLACEHOLDER', true],
  ['booking_lead_minutes', 60, 'Earliest bookable slot, in minutes from now', true],
  ['booking_horizon_days', 60, 'How far ahead patients may book', true],
  ['cancellation_cutoff_hours', 2, 'Patients may cancel or reschedule online until this many hours before', true],
  ['pharmacy_delivery_fee', 49, 'Delivery fee for medication orders', true],
  ['pharmacy_free_delivery_over', 999, 'Subtotal from which delivery is free', true],
  ['payments_mode', 'demo', "'demo' records simulated donations; set to a provider name only after server-side verification is configured", true],
  ['site_url', '', 'Public URL used in emailed links (e.g. https://a10.example)', false],
]

const departments = [
  ['Cardiology', 'heart-pulse', 'Heart and vascular care', 'Assessment and ongoing management of heart rhythm, blood pressure and vascular conditions, coordinated with diagnostics and rehabilitation.', ['ECG and Holter monitoring', 'Echocardiography', 'Hypertension clinic', 'Cardiac rehabilitation guidance']],
  ['Neurology', 'brain', 'Brain, spine and nerve care', 'Outpatient evaluation for headaches, seizures, movement disorders and nerve conditions, with access to imaging and neurophysiology.', ['Headache and migraine clinic', 'EEG and nerve conduction studies', 'Stroke follow-up', 'Movement disorder review']],
  ['Orthopaedics', 'bone', 'Bones, joints and mobility', 'Care for joint pain, sports injuries, fractures and spine conditions, from first consultation to recovery planning.', ['Sports injury clinic', 'Joint pain assessment', 'Fracture follow-up', 'Physiotherapy referral']],
  ['Paediatrics', 'baby', 'Care for infants, children and teens', 'Child-friendly consultations covering growth, development, vaccinations and common childhood illnesses.', ['Well-child visits', 'Vaccination schedule review', 'Growth and nutrition', 'Adolescent health']],
  ['Dermatology', 'sparkles', 'Skin, hair and nail health', 'Diagnosis and treatment planning for skin, hair and nail conditions in a calm, private setting.', ['Acne and eczema care', 'Mole checks', 'Hair and scalp clinic', 'Allergy patch testing']],
  ['General Medicine', 'stethoscope', 'Everyday adult health', 'First-contact care for adults, preventive health checks and coordination with specialist teams.', ['Preventive health checks', 'Diabetes and thyroid review', 'Fever and infection care', 'Chronic condition follow-up']],
  ['Gynaecology', 'flower-2', "Women's health at every stage", "Consultations for menstrual health, pregnancy planning, menopause and routine women's health screening.", ['Antenatal consultations', 'Menstrual health', 'Menopause clinic', 'Screening and preventive care']],
  ['ENT', 'ear', 'Ear, nose and throat', 'Assessment of hearing, sinus, voice and throat concerns for adults and children.', ['Hearing assessment', 'Sinus clinic', 'Voice and swallowing review', 'Allergy care']],
  ['Ophthalmology', 'eye', 'Vision and eye health', 'Eye examinations, vision testing and treatment planning for common and chronic eye conditions.', ['Comprehensive eye exam', 'Cataract assessment', 'Glaucoma monitoring', 'Diabetic eye screening']],
  ['Diagnostics and Laboratory Services', 'flask-conical', 'Imaging and laboratory testing', 'Sample collection, laboratory testing and imaging support for every department, with results released to your patient portal.', ['Blood and urine tests', 'Digital X-ray', 'Ultrasound', 'Home sample collection (where available)']],
]

const first = ['Ananya', 'Rohan', 'Meera', 'Kabir', 'Isha', 'Arjun', 'Nisha', 'Vikram', 'Tara', 'Dev', 'Kavya', 'Aditya', 'Leela', 'Sameer', 'Priya', 'Neel', 'Anika', 'Farhan', 'Diya', 'Rahul', 'Sana', 'Ishaan', 'Mira', 'Karan', 'Zoya', 'Varun', 'Aisha', 'Nikhil', 'Pooja', 'Omar', 'Riya', 'Yash', 'Tanvi', 'Aryan', 'Naina', 'Kunal', 'Esha', 'Hari', 'Lavanya', 'Siddharth']
const last = ['Sample', 'Demoray', 'Example', 'Mockley', 'Fictional', 'Testwell', 'Mockford', 'Specimen', 'Prototype', 'Samplewood', 'Demonte', 'Placeholder']
const specialities = {
  Cardiology: ['Cardiologist', 'Interventional Cardiology (sample)', 'Preventive Cardiology (sample)'],
  Neurology: ['Neurologist', 'Epilepsy care (sample)', 'Headache medicine (sample)'],
  Orthopaedics: ['Orthopaedic Surgeon', 'Sports Medicine (sample)', 'Spine care (sample)'],
  Paediatrics: ['Paediatrician', 'Neonatal care (sample)', 'Adolescent health (sample)'],
  Dermatology: ['Dermatologist', 'Paediatric dermatology (sample)'],
  'General Medicine': ['Internal Medicine', 'Family Medicine (sample)', 'Diabetes care (sample)'],
  Gynaecology: ['Obstetrician & Gynaecologist', 'Reproductive health (sample)'],
  ENT: ['ENT Specialist', 'Paediatric ENT (sample)'],
  Ophthalmology: ['Ophthalmologist', 'Glaucoma care (sample)'],
  'Diagnostics and Laboratory Services': ['Pathologist', 'Radiologist'],
}
const languages = [['English', 'Hindi'], ['English', 'Tamil'], ['English', 'Kannada', 'Hindi'], ['English', 'Bengali'], ['English', 'Marathi', 'Hindi'], ['English', 'Telugu'], ['English', 'Malayalam']]

const lines = []
lines.push('-- GENERATED by scripts/build-seed.mjs — do not edit by hand.')
lines.push('-- Synthetic reference data. All doctors are fictional sample profiles (is_sample = true).')
lines.push('-- Do not load this file into a production database.\n')
lines.push('USE a10_hospital;\n')

for (const [key, value, description, isPublic] of settings) {
  lines.push(`INSERT IGNORE INTO settings (\`key\`, value, description, is_public) values (${q(key)}, ${q(JSON.stringify(value))}, ${q(description)}, ${isPublic});`)
}
lines.push('')

departments.forEach(([name, icon, summary, description, services], i) => {
  const slug = slugify(name === 'Diagnostics and Laboratory Services' ? 'diagnostics' : name)
  lines.push(`INSERT IGNORE INTO departments (id, slug, name, summary, description, icon, image_url, services, sort_order, is_sample) values (${q(uuid('dept:' + slug))}, ${q(slug)}, ${q(name)}, ${q(summary)}, ${q(description)}, ${q(icon)}, ${q(`/images/departments/${slug}.webp`)}, ${arr(services)}, ${i * 10}, true);`)
})
lines.push('')

const availabilityPatterns = [
  [[1, '09:00', '13:00'], [3, '09:00', '13:00'], [5, '14:00', '17:00']],
  [[2, '10:00', '14:00'], [4, '10:00', '14:00'], [6, '09:00', '12:00']],
  [[1, '14:00', '18:00'], [2, '14:00', '18:00'], [4, '09:00', '12:00']],
  [[3, '10:00', '16:00'], [5, '09:00', '12:00']],
  [[1, '09:30', '12:30'], [2, '09:30', '12:30'], [3, '09:30', '12:30'], [4, '09:30', '12:30'], [5, '09:30', '12:30']],
]

let n = 0
const doctors = []
departments.forEach(([dept]) => {
  const deptSlug = slugify(dept === 'Diagnostics and Laboratory Services' ? 'diagnostics' : dept)
  const count = dept === 'General Medicine' ? 6 : dept === 'Diagnostics and Laboratory Services' ? 2 : 4
  for (let k = 0; k < count; k++) {
    const name = `Dr. ${first[n % first.length]} ${last[(n * 7) % last.length]}`
    const slug = slugify(name.replace('Dr. ', ''))
    const spec = specialities[dept][k % specialities[dept].length]
    const years = 3 + ((n * 7) % 24)
    const fee = 500 + ((n * 150) % 1300)
    const bookable = dept !== 'Diagnostics and Laboratory Services'
    doctors.push({ id: uuid('doc:' + slug), slug })
    lines.push(`INSERT IGNORE INTO doctors (id, slug, full_name, department_id, speciality, qualifications, qualifications_verified, years_experience, bio, languages, consultation_fee, consultation_minutes, is_sample) values (${q(uuid('doc:' + slug))}, ${q(slug)}, ${q(name)}, ${q(uuid('dept:' + deptSlug))}, ${q(spec)}, ${arr(['MBBS (sample)', k % 2 ? 'MD (sample)' : 'MS (sample)'])}, false, ${years}, ${q(`${name} is a fictional sample profile used to demonstrate the A10 Hospital directory. Biography, qualifications and experience shown here are illustrative and must be replaced with verified information before launch.`)}, ${arr(languages[n % languages.length])}, ${fee}, 20, true);`)
    if (bookable) {
      for (const [weekday, start, end] of availabilityPatterns[n % availabilityPatterns.length]) {
        lines.push(`INSERT IGNORE INTO doctor_availability (id, doctor_id, weekday, start_time, end_time, slot_minutes) values (${q(uuid(`avail:${slug}:${weekday}`))}, ${q(uuid('doc:' + slug))}, ${weekday}, ${q(start)}, ${q(end)}, 20);`)
      }
    }
    n++
  }
})
lines.push('')

const medicines = [
  // name, generic, category, form, strength, pack, price, rx, stock, description
  ['Paracetamol', 'Paracetamol', 'Pain & Fever', 'Tablet', '500 mg', 'Strip of 15', 30, false, 400, 'Commonly used for relief of mild pain and fever. Follow the label or your doctor\'s advice.'],
  ['Ibuprofen', 'Ibuprofen', 'Pain & Fever', 'Tablet', '400 mg', 'Strip of 10', 42, false, 220, 'Anti-inflammatory pain reliever. Not suitable for everyone — check with a pharmacist.'],
  ['Cetirizine', 'Cetirizine hydrochloride', 'Allergy', 'Tablet', '10 mg', 'Strip of 10', 25, false, 300, 'Antihistamine used for seasonal allergy symptoms. May cause drowsiness.'],
  ['Oral Rehydration Salts', 'ORS (WHO formula)', 'Digestive Health', 'Sachet', '21 g', 'Pack of 5', 60, false, 260, 'Replaces fluids and salts lost through dehydration.'],
  ['Antacid Suspension', 'Aluminium & magnesium hydroxide', 'Digestive Health', 'Suspension', '170 ml', 'Bottle', 95, false, 140, 'For short-term relief of acidity and heartburn.'],
  ['Vitamin D3', 'Cholecalciferol', 'Vitamins & Supplements', 'Capsule', '1000 IU', 'Strip of 10', 120, false, 180, 'Dietary supplement. Take as advised by a healthcare professional.'],
  ['Multivitamin', 'Multivitamin & minerals', 'Vitamins & Supplements', 'Tablet', null, 'Bottle of 30', 260, false, 150, 'General daily supplement for adults.'],
  ['Saline Nasal Spray', 'Sodium chloride 0.65%', 'Cold & Cough', 'Spray', '20 ml', 'Bottle', 110, false, 120, 'Moisturises dry nasal passages.'],
  ['Honey & Lemon Lozenges', null, 'Cold & Cough', 'Lozenge', null, 'Pack of 16', 70, false, 200, 'Soothes minor throat irritation.'],
  ['Antiseptic Liquid', 'Chloroxylenol', 'First Aid', 'Liquid', '125 ml', 'Bottle', 85, false, 160, 'For cleaning minor cuts and grazes.'],
  ['Sterile Gauze Pads', null, 'First Aid', 'Dressing', '10 × 10 cm', 'Pack of 10', 90, false, 140, 'Sterile, individually wrapped dressings.'],
  ['Digital Thermometer', null, 'Devices', 'Device', null, '1 unit', 249, false, 60, 'Fast-read digital thermometer.'],
  ['Hand Sanitiser', 'Ethanol 70%', 'Personal Care', 'Gel', '200 ml', 'Bottle', 99, false, 200, 'Alcohol-based hand rub.'],
  ['Moisturising Cream', null, 'Skin Care', 'Cream', '100 g', 'Tube', 210, false, 90, 'Fragrance-free moisturiser for dry skin.'],
  ['Amoxicillin', 'Amoxicillin', 'Antibiotics', 'Capsule', '500 mg', 'Strip of 10', 95, true, 120, 'Prescription-only antibiotic. Dispensed only against a valid prescription.'],
  ['Azithromycin', 'Azithromycin', 'Antibiotics', 'Tablet', '500 mg', 'Strip of 3', 110, true, 90, 'Prescription-only antibiotic. Dispensed only against a valid prescription.'],
  ['Metformin', 'Metformin hydrochloride', 'Diabetes Care', 'Tablet', '500 mg', 'Strip of 20', 48, true, 200, 'Prescription-only. Used in the management of type 2 diabetes under medical supervision.'],
  ['Atorvastatin', 'Atorvastatin', 'Heart Health', 'Tablet', '10 mg', 'Strip of 15', 120, true, 150, 'Prescription-only. Lipid-lowering medication.'],
  ['Amlodipine', 'Amlodipine besylate', 'Heart Health', 'Tablet', '5 mg', 'Strip of 15', 55, true, 170, 'Prescription-only. Used for blood pressure management.'],
  ['Losartan', 'Losartan potassium', 'Heart Health', 'Tablet', '50 mg', 'Strip of 15', 85, true, 130, 'Prescription-only. Used for blood pressure management.'],
  ['Levothyroxine', 'Levothyroxine sodium', 'Thyroid Care', 'Tablet', '50 mcg', 'Bottle of 100', 160, true, 110, 'Prescription-only thyroid hormone replacement.'],
  ['Pantoprazole', 'Pantoprazole', 'Digestive Health', 'Tablet', '40 mg', 'Strip of 15', 135, true, 160, 'Prescription-only. Reduces stomach acid.'],
  ['Salbutamol Inhaler', 'Salbutamol', 'Respiratory', 'Inhaler', '100 mcg/dose', '200 doses', 180, true, 70, 'Prescription-only reliever inhaler.'],
  ['Montelukast', 'Montelukast sodium', 'Respiratory', 'Tablet', '10 mg', 'Strip of 10', 165, true, 80, 'Prescription-only. Used in asthma and allergy management.'],
]
for (const [name, generic, category, form, strength, pack, price, rx, stock, description] of medicines) {
  const slug = slugify(`${name} ${strength ?? ''}`)
  lines.push(`INSERT IGNORE INTO medicines (id, slug, name, generic_name, category, form, strength, pack_size, description, price, requires_prescription, stock, is_sample) values (${q(uuid('med:' + slug))}, ${q(slug)}, ${q(name)}, ${q(generic)}, ${q(category)}, ${q(form)}, ${q(strength)}, ${q(pack)}, ${q(description)}, ${price}, ${rx}, ${stock}, true);`)
}
lines.push('')

const causes = [
  ['patient-support-fund', 'Patient Support Fund', 'Helps patients who face financial hardship meet the cost of consultations, diagnostics and medication. (Sample cause — confirm programme details before launch.)', 10],
  ['childrens-care', "Children's Care Programme", "Supports child-friendly spaces, play materials and family support for young patients and their carers. (Sample cause.)", 20],
  ['community-health-camps', 'Community Health Camps', 'Funds free screening camps and health-awareness sessions in the wider community. (Sample cause.)', 30],
  ['equipment-fund', 'Equipment & Facilities Fund', 'Contributes towards diagnostic equipment and patient-comfort improvements. (Sample cause.)', 40],
]
for (const [slug, title, description, order] of causes) {
  lines.push(`INSERT IGNORE INTO donation_causes (id, slug, title, description, sort_order, is_sample) values (${q(uuid('cause:' + slug))}, ${q(slug)}, ${q(title)}, ${q(description)}, ${order}, true);`)
}

writeFileSync(new URL('../database/seed.sql', import.meta.url), lines.join('\n') + '\n')
console.log(`seed.sql: ${departments.length} departments, ${doctors.length} doctors, ${medicines.length} medicines, ${causes.length} causes`)
