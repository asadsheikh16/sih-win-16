"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const users = [
    { id: 'USR-001', name: 'Dr. Ananya Sharma', email: 'doctor@niramay.demo', role: 'DOCTOR', department: 'General Medicine' },
    { id: 'USR-002', name: 'Ravi Kumar', email: 'operator@niramay.demo', role: 'REGISTRATION_OPERATOR', department: 'OPD Registration' },
    { id: 'USR-003', name: 'Neha Singh', email: 'pharmacy@niramay.demo', role: 'PHARMACIST', department: 'Central Pharmacy' }
];
const patients = [
    { id: 'PAT-001', niramayId: 'NIR-RJ-2026-002184', name: 'Meera Sharma', mobile: '9876543210', facility: 'District Hospital, Kota' },
    { id: 'PAT-002', niramayId: 'NIR-RJ-2026-001097', name: 'Ramesh Verma', mobile: '9821155342', facility: 'District Hospital, Kota' },
    { id: 'PAT-003', niramayId: 'NIR-RJ-2026-002106', name: 'Farah Khan', mobile: '9987120119', facility: 'District Hospital, Kota' }
];
const loginSchema = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(1) });
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ONLINE', demoMode: true }));
app.post('/api/v1/auth/login', (req, res, next) => {
    try {
        const input = loginSchema.parse(req.body);
        void prisma.user.findUnique({ where: { email: input.email }, include: { roles: { include: { role: true } } } }).then(user => {
            if (!user || input.password !== 'Demo@123')
                return res.status(401).json({ error: 'Invalid demo credentials' });
            return res.json({ token: `demo-${user.id}-${Date.now()}`, user: { id: user.id, name: user.name, email: user.email, role: user.roles[0]?.role.name || 'PATIENT' }, demoMode: true });
        }).catch(() => {
            const fallback = users.find(candidate => candidate.email === input.email && input.password === 'Demo@123');
            return fallback ? res.json({ token: `legacy-${fallback.id}-${Date.now()}`, user: fallback, demoMode: true, database: 'fallback' }) : res.status(401).json({ error: 'Invalid demo credentials' });
        });
    }
    catch (error) {
        return next(error);
    }
});
app.use('/api/v1', (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Authentication required' });
    next();
});
app.get('/api/v1/patients', (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    void prisma.patient.findMany({ where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { niramayId: { contains: q, mode: 'insensitive' } }, { contacts: { some: { value: { contains: q } } } }] } : undefined, orderBy: { createdAt: 'desc' }, take: 100 }).then(data => res.json({ data, demoMode: true })).catch(() => res.json({ data: q ? patients.filter(patient => JSON.stringify(patient).toLowerCase().includes(q)) : patients, demoMode: true, database: 'fallback' }));
});
app.get('/api/v1/patients/:id', (req, res) => {
    void prisma.patient.findFirst({ where: { OR: [{ id: req.params.id }, { niramayId: req.params.id }] }, include: { identifiers: true, contacts: true, allergies: true, histories: true, consultations: true, prescriptions: { include: { items: true } }, investigations: { include: { investigation: true, labResult: true } } } }).then(patient => patient ? res.json({ data: patient }) : res.status(404).json({ error: 'Patient not found' })).catch(() => { const patient = patients.find(candidate => candidate.id === req.params.id || candidate.niramayId === req.params.id); return patient ? res.json({ data: patient, database: 'fallback' }) : res.status(404).json({ error: 'Patient not found' }); });
});
app.post('/api/v1/cards', async (req, res, next) => { try {
    const input = zod_1.z.object({ patientId: zod_1.z.string() }).parse(req.body);
    const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
    if (!patient)
        return res.status(404).json({ error: 'Patient not found' });
    const existing = await prisma.patientCard.findFirst({ where: { patientId: patient.id }, orderBy: { issueDate: 'desc' } });
    const card = existing || await prisma.patientCard.create({ data: { patientId: patient.id, facilityId: patient.facilityId, secureRef: `NIRAMAY-${(0, node_crypto_1.randomBytes)(18).toString('hex')}` } });
    return res.status(201).json({ data: { ...card, qrPayload: `niramay://card/${card.secureRef}` }, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/cards/:secureRef', async (req, res, next) => { try {
    const card = await prisma.patientCard.findUnique({ where: { secureRef: req.params.secureRef }, include: { patient: true, facility: true } });
    if (!card)
        return res.status(404).json({ error: 'Secure card reference not found' });
    return res.json({ data: { id: card.id, secureRef: card.secureRef, issueDate: card.issueDate, patient: { id: card.patient.id, niramayId: card.patient.niramayId, name: card.patient.name, dob: card.patient.dob, gender: card.patient.gender, bloodGroup: card.patient.bloodGroup }, facility: card.facility.name }, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.post('/api/v1/patients', async (req, res, next) => { try {
    const input = zod_1.z.object({ name: zod_1.z.string().min(2), mobile: zod_1.z.string().optional(), gender: zod_1.z.string().optional(), bloodGroup: zod_1.z.string().optional() }).parse(req.body);
    const facility = await prisma.facility.findUnique({ where: { code: 'DH-KOT-042' } });
    if (!facility)
        return res.status(503).json({ error: 'Demo facility is not seeded' });
    const patient = await prisma.patient.create({ data: { niramayId: `NIR-RJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, name: input.name, gender: input.gender, bloodGroup: input.bloodGroup, facilityId: facility.id, contacts: input.mobile ? { create: { type: 'MOBILE', value: input.mobile } } : undefined } });
    return res.status(201).json({ data: patient, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/dashboard', async (_req, res) => { try {
    const [waiting, completed, emergency, pharmacyPending, investigationsPending] = await Promise.all([prisma.queueToken.count({ where: { status: client_1.QueueStatus.WAITING } }), prisma.queueToken.count({ where: { status: client_1.QueueStatus.COMPLETED } }), prisma.queueToken.count({ where: { priority: 'EMERGENCY' } }), prisma.prescription.count({ where: { status: 'PENDING' } }), prisma.investigationOrder.count({ where: { status: { not: 'COMPLETED' } } })]);
    return res.json({ facility: 'District Hospital, Kota', metrics: { opd: 248, waiting, completed, emergency, pharmacyPending, investigationsPending, followups: 18 }, demoMode: true });
}
catch {
    return res.json({ facility: 'District Hospital, Kota', metrics: { opd: 248, waiting: 67, completed: 159, emergency: 8, pharmacyPending: 31, investigationsPending: 24, followups: 18 }, demoMode: true, database: 'fallback' });
} });
app.get('/api/v1/queue', async (_req, res) => { try {
    const data = await prisma.queueToken.findMany({ include: { patient: true, department: true }, orderBy: { createdAt: 'asc' } });
    return res.json({ data, demoMode: true });
}
catch {
    return res.json({ data: [], demoMode: true, database: 'fallback' });
} });
app.patch('/api/v1/queue/:id', async (req, res, next) => { try {
    const input = zod_1.z.object({ status: zod_1.z.nativeEnum(client_1.QueueStatus) }).parse(req.body);
    const token = await prisma.queueToken.update({ where: { id: req.params.id }, data: { status: input.status } });
    return res.json({ data: token, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.post('/api/v1/opd/register', async (req, res, next) => { try {
    const input = zod_1.z.object({ patientId: zod_1.z.string(), departmentId: zod_1.z.string(), priority: zod_1.z.string().optional() }).parse(req.body);
    const registration = await prisma.opdRegistration.create({ data: { patientId: input.patientId, departmentId: input.departmentId } });
    const token = await prisma.queueToken.create({ data: { token: `OPD-${String(Date.now()).slice(-3)}`, patientId: input.patientId, departmentId: input.departmentId, priority: input.priority || 'ROUTINE' } });
    return res.status(201).json({ data: { registration, token }, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.post('/api/v1/consultations', async (req, res, next) => { try {
    const input = zod_1.z.object({ patientId: zod_1.z.string(), doctorId: zod_1.z.string(), chiefComplaint: zod_1.z.string().optional(), history: zod_1.z.string().optional(), examination: zod_1.z.string().optional(), diagnosis: zod_1.z.string().optional(), followupDate: zod_1.z.string().optional(), vitals: zod_1.z.object({ bloodPressure: zod_1.z.string().optional(), pulse: zod_1.z.number().optional(), temperature: zod_1.z.number().optional(), spo2: zod_1.z.number().optional(), respiratoryRate: zod_1.z.number().optional(), height: zod_1.z.number().optional(), weight: zod_1.z.number().optional() }).optional() }).parse(req.body);
    const consultation = await prisma.consultation.create({ data: { patientId: input.patientId, doctorId: input.doctorId, chiefComplaint: input.chiefComplaint, history: input.history, examination: input.examination, diagnosis: input.diagnosis, followupDate: input.followupDate ? new Date(input.followupDate) : undefined, vitals: input.vitals ? { create: { patientId: input.patientId, ...input.vitals } } : undefined } });
    return res.status(201).json({ data: consultation, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/prescriptions', async (_req, res) => { try {
    const data = await prisma.prescription.findMany({ include: { patient: true, items: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ data, demoMode: true });
}
catch {
    return res.json({ data: [], demoMode: true, database: 'fallback' });
} });
app.post('/api/v1/prescriptions', async (req, res, next) => { try {
    const input = zod_1.z.object({ patientId: zod_1.z.string(), doctorId: zod_1.z.string(), consultationId: zod_1.z.string().optional(), followupDate: zod_1.z.string().optional(), items: zod_1.z.array(zod_1.z.object({ medicine: zod_1.z.string().min(2), dose: zod_1.z.string(), route: zod_1.z.string().optional(), frequency: zod_1.z.string(), duration: zod_1.z.string(), instructions: zod_1.z.string().optional() })).min(1) }).parse(req.body);
    const prescription = await prisma.prescription.create({ data: { patientId: input.patientId, doctorId: input.doctorId, consultationId: input.consultationId, followupDate: input.followupDate ? new Date(input.followupDate) : undefined, items: { create: input.items } }, include: { items: true } });
    return res.status(201).json({ data: prescription, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/pharmacy', async (_req, res) => { try {
    const data = await prisma.prescription.findMany({ where: { status: { in: ['PENDING', 'PARTIALLY_DISPENSED'] } }, include: { patient: true, items: true }, orderBy: { createdAt: 'asc' } });
    return res.json({ data, demoMode: true });
}
catch {
    return res.json({ data: [], demoMode: true, database: 'fallback' });
} });
app.post('/api/v1/pharmacy/:id/dispense', async (req, res, next) => { try {
    const prescription = await prisma.prescription.update({ where: { id: req.params.id }, data: { status: 'DISPENSED' }, include: { items: true } });
    return res.json({ data: prescription, receiptId: `REC-${Date.now()}`, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/investigations', async (_req, res) => { try {
    const data = await prisma.investigationOrder.findMany({ include: { patient: true, investigation: true, labResult: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ data, demoMode: true });
}
catch {
    return res.json({ data: [], demoMode: true, database: 'fallback' });
} });
app.post('/api/v1/investigations', async (req, res, next) => { try {
    const input = zod_1.z.object({ patientId: zod_1.z.string(), investigationId: zod_1.z.string(), consultationId: zod_1.z.string().optional() }).parse(req.body);
    const order = await prisma.investigationOrder.create({ data: input });
    return res.status(201).json({ data: order, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.post('/api/v1/investigations/:id/result', async (req, res, next) => { try {
    const input = zod_1.z.object({ result: zod_1.z.string().min(1), unit: zod_1.z.string().optional(), referenceRange: zod_1.z.string().optional(), remarks: zod_1.z.string().optional(), verified: zod_1.z.boolean().optional() }).parse(req.body);
    const order = await prisma.investigationOrder.update({ where: { id: req.params.id }, data: { status: input.verified ? 'VERIFIED' : 'COMPLETED', labResult: { upsert: { create: input, update: input } } }, include: { labResult: true } });
    return res.json({ data: order, demoMode: true });
}
catch (error) {
    return next(error);
} });
app.get('/api/v1/analytics', async (_req, res) => { try {
    const [patients, queue, consultations, investigations, prescriptions] = await Promise.all([prisma.patient.count(), prisma.queueToken.groupBy({ by: ['status'], _count: true }), prisma.consultation.count(), prisma.investigationOrder.groupBy({ by: ['status'], _count: true }), prisma.prescription.count()]);
    return res.json({ data: { patients, consultations, prescriptions, queue, investigations, dailyOpd: [32, 41, 38, 52, 47, 58, 49], departments: [{ name: 'General Medicine', value: 42 }, { name: 'Emergency', value: 18 }, { name: 'Pediatrics', value: 15 }, { name: 'Other', value: 25 }] }, demoMode: true });
}
catch {
    return res.json({ data: { patients: 4, consultations: 18, prescriptions: 22, queue: [], investigations: [], dailyOpd: [32, 41, 38, 52, 47, 58, 49], departments: [] }, demoMode: true, database: 'fallback' });
} });
app.get('/api/v1/audit', async (_req, res) => { try {
    const data = await prisma.auditLog.findMany({ include: { user: true, facility: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ data, demoMode: true });
}
catch {
    return res.json({ data: [], demoMode: true, database: 'fallback' });
} });
app.use((_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use((error, _req, res, _next) => {
    if (error instanceof zod_1.z.ZodError)
        return res.status(400).json({ error: 'Validation failed', details: error.flatten() });
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
});
exports.default = app;
