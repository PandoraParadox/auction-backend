const express = require('express');
const router = express.Router();
const { getUserInfo, getAllUser, deleteUsers, updateUser } = require('../model/user');
const UserController = require(`../model/user`)


router.get('/get/all', UserController.getAllUser);
router.delete('/delete/:uid', UserController.deleteUsers);
router.get('/:uid', UserController.getUserInfo);
router.put('/update/:uid', UserController.updateUser);
router.post('/login/:idToken', UserController.authenrization);


module.exports = router;
