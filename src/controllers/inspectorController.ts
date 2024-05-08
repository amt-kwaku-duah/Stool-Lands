import { Request, Response } from 'express';
import { hashSync } from 'bcrypt';
import { PrismaClient,ROLE } from '@prisma/client';
import { backroomMessage } from '../services/backRoom';
import { Inspector } from 'aws-sdk';

const prisma = new PrismaClient();

const generateInspectorId = async (): Promise<string> => {
  const existingInspectorCount = await prisma.inspector.count();
  const inspectorCount = existingInspectorCount + 1;
  const inspectorId = `INSPECTOR-${inspectorCount.toString().padStart(3, '0')}`;
  return inspectorId;
};

export const createInspector = async (req: Request, res: Response) => {
  try {
    const { name, email, phoneNumber, occupation, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const hashedPassword = hashSync(newPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phoneNumber,
        occupation,
        password: hashedPassword,
        role: ROLE.INSPECTOR,
      },
    });

    const inspectorId = await generateInspectorId();

    const newInspector = await prisma.inspector.create({
      data: {
        email: newUser.email!,
        inspectorId,
      },
    });

    const user = await prisma.user.findFirst({
      where: {
        email: email
      }
    });

    const frontendURL = process.env.FRONTEND_ORIGIN || '';

    const link = `${frontendURL}/resetPswd/${user?.id}`
    console.log(link)
    await backroomMessage(name, email, phoneNumber,newPassword,occupation,link);

    res.status(201).json({ message: 'Inspector created successfully', inspector: newInspector });
  } catch (error) {
    console.error('Error occurred while creating inspector:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
};