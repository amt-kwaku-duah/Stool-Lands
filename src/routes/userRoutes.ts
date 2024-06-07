import {Router}from 'express';
import { allUsers, getAllForms, specificForms, userDeactivate,deleteUser } from '../controllers/userController';
import { authMiddleware,roleMiddleware } from '../middleWares/authMiddleware';

const userRoute: Router = Router()

userRoute.get('/users',[authMiddleware,roleMiddleware], allUsers)
// route for admin/secretary
userRoute.get('/forms',[authMiddleware,roleMiddleware],getAllForms)

userRoute.post('/user-deactivate',[authMiddleware,roleMiddleware], userDeactivate)
userRoute.post('/user-del',[authMiddleware,roleMiddleware],deleteUser)
userRoute.get("/:userid", [authMiddleware,roleMiddleware],specificForms)
export default userRoute;