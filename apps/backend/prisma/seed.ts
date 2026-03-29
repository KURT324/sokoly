import { PrismaClient, ChatType, DayStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Admin user
  const adminHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edu.local' },
    update: {},
    create: {
      email: 'admin@edu.local',
      password_hash: adminHash,
      callsign: 'Администратор',
      role: 'ADMIN',
      must_change_password: false,
      is_active: true,
    },
  });
  console.log('Created admin:', admin.email);

  // Test cohort
  const cohort = await prisma.cohort.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Тестовая группа',
      started_at: new Date(),
      is_active: true,
    },
  });
  console.log('Created cohort:', cohort.name);

  // 11 days for test cohort
  for (let i = 1; i <= 11; i++) {
    await prisma.day.upsert({
      where: {
        id: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
      },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, '0')}`,
        day_number: i,
        cohort_id: cohort.id,
        status: DayStatus.LOCKED,
      },
    });
  }
  console.log('Created 11 days for test cohort');

  // 3 chats for test cohort
  const chats = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      type: ChatType.GROUP,
      name: 'Общий чат группы',
    },
    {
      id: '00000000-0000-0000-0001-000000000002',
      type: ChatType.STUDENT_TEACHER,
      name: 'Чат с преподавателем',
    },
    {
      id: '00000000-0000-0000-0001-000000000003',
      type: ChatType.STUDENT_ADMIN,
      name: 'Чат с администратором',
    },
  ];

  for (const chat of chats) {
    await prisma.chat.upsert({
      where: { id: chat.id },
      update: {},
      create: {
        id: chat.id,
        type: chat.type,
        cohort_id: cohort.id,
        name: chat.name,
      },
    });
  }
  console.log('Created 3 chats for test cohort');

  // Teacher
  const teacherHash = await bcrypt.hash('Teacher1234!', 12);
  await prisma.user.upsert({
    where: { email: 'teacher@edu.local' },
    update: {},
    create: {
      email: 'teacher@edu.local',
      password_hash: teacherHash,
      callsign: 'Сокол',
      role: 'TEACHER',
      must_change_password: false,
      is_active: true,
    },
  });
  console.log('Created teacher: teacher@edu.local');

  // Student
  const studentHash = await bcrypt.hash('Student1234!', 12);
  await prisma.user.upsert({
    where: { email: 'student@edu.local' },
    update: {},
    create: {
      email: 'student@edu.local',
      password_hash: studentHash,
      callsign: 'Буря',
      role: 'STUDENT',
      cohort_id: cohort.id,
      must_change_password: false,
      is_active: true,
      watermark_id: uuidv4(),
    },
  });
  console.log('Created student: student@edu.local');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
