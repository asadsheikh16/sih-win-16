import { PrismaClient, RoleName } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const hospital = await prisma.hospital.upsert({ where: { id: 'HOSP-KOTA' }, update: {}, create: { id: 'HOSP-KOTA', name: 'District Hospital Network', district: 'Kota', state: 'Rajasthan' } });
  const facility = await prisma.facility.upsert({ where: { code: 'DH-KOT-042' }, update: {}, create: { id: 'DH-KOT-042', hospitalId: hospital.id, name: 'District Hospital, Kota', code: 'DH-KOT-042', district: 'Kota', state: 'Rajasthan' } });
  for (const name of Object.values(RoleName)) await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  const doctorRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.DOCTOR } });
  const doctor = await prisma.user.upsert({ where: { email: 'doctor@niramay.demo' }, update: {}, create: { id: 'USR-001', name: 'Dr. Ananya Sharma', email: 'doctor@niramay.demo', passwordHash: 'DEMO_PASSWORD_HASH', facilityId: facility.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: doctor.id, roleId: doctorRole.id } }, update: {}, create: { userId: doctor.id, roleId: doctorRole.id } });
  const operatorRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.REGISTRATION_OPERATOR } });
  const operator = await prisma.user.upsert({ where: { email: 'operator@niramay.demo' }, update: {}, create: { id: 'USR-002', name: 'Ravi Kumar', email: 'operator@niramay.demo', passwordHash: 'DEMO_PASSWORD_HASH', facilityId: facility.id } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: operator.id, roleId: operatorRole.id } }, update: {}, create: { userId: operator.id, roleId: operatorRole.id } });
  const departments = ['General Medicine','Emergency','Pediatrics','Orthopedics','Gynecology','ENT','Dermatology','AYUSH','Laboratory','Pharmacy'];
  for (const name of departments) await prisma.department.upsert({ where: { id: `DEPT-${name.replaceAll(' ','-').toUpperCase()}` }, update: {}, create: { id: `DEPT-${name.replaceAll(' ','-').toUpperCase()}`, facilityId: facility.id, name } });
  await prisma.doctor.upsert({ where: { userId: doctor.id }, update: {}, create: { id: 'DOC-001', userId: doctor.id, departmentId: 'DEPT-GENERAL-MEDICINE' } });
  console.log(`Seeded ${facility.name} with ${departments.length} departments and ${Object.values(RoleName).length} roles.`);
}
main().finally(() => prisma.$disconnect());
