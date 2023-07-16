import { verifyName, verifyUsername, verifyPassword, verifyHonorific, verifyEmail } from "../../../utils/verify"
import { generateToken } from '../../../utils/generateToken'
import connectDB from '../../../utils/connectDB'
import User from '../../../models/userModel'
const bcrypt = require('bcryptjs')
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS)

/**
 * @desc    Create new user
 * @route   POST /api/user/create
 * @access  Public
 * @param   {string} req.body.password - Min 8 characters long. Max 55 characters long. Must contain a capital, lowercase, and a number.
 * @param   {string} req.body.username - Min 2 characters long. Max 15 characters long. Can only contain alphabetical characters and numbers (no spaces).
 * @param   {string} req.body.firstName - Max 55 characters long. Can only contain alphabetical characters.
 * @param   {string} req.body.lastName - Max 55 characters long. Can only contain alphabetical characters.
 * @param   {string} req.body.honorific - Can be "Mr.", "Ms.", "Mrs.", "Dr.", "Jr.", or none
 * @param   {string} req.body.email - Max 255 characters long.
 * @param   {string} req.body.parentEmail - Max 255 characters long.
 */
export default async function handler(req, res) {
  try {
    if(req.method !== 'POST') {
      throw new Error(`${req.method} is an invalid request method`)
    }

    // Connect to database
    await connectDB()

    // TODO: Get rid of the parse on the actual version
    const userType = parseInt(req.body.userType)
    const {
        // Mandatory for all
        password,
        // Optional names
        username,
        firstName,
        lastName,
        honorific,
        // Optional identifiers
        email,
        parentEmail,
    } = req.body

    if(!userType) {
      throw new Error('Missing user type')
    }
    if(userType !== 1 && userType !== 2 && userType !== 3) {
      throw new Error('Invalid user type')
    }

    // Verify that the fields are not empty and valid
    verifyName(firstName)
    verifyName(lastName)
    verifyPassword(password)

    if(userType === 2 || userType === 3) {
      verifyHonorific(honorific)
    }

    // Hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Parent or teacher sign up
    if (userType === 2 || userType === 3) {
      // Make sure email is not empty and valid
      verifyEmail(email)

      const lowercaseEmail = email.toLowerCase()

      // Make sure email is not already used
      let userExists = await User.findOne({ email: lowercaseEmail })
      if (userExists) {
        throw new Error('Email already used')
      }
 
      // Parent registration
      if (userType === 2) {
        // Create parent (if there is no honorific, it will be undefined and not added to MongoDb)
        const user = await User.create({
          userType,
          firstName,
          lastName,
          honorific,
          password: hashedPassword,
          email: lowercaseEmail,
          students: []
        })
        user.password = undefined

        // Confirm parent creation
        if (user) {
          res.status(201).json({
            user: user,
            token: generateToken(user._id),
          })
          return
        }
      }

      // Teacher registration
      else if(userType === 3) {
        // Create teacher (if there is no honorific, it will be undefined and not added to MongoDb)
        const user = await User.create({
          userType,
          firstName,
          lastName,
          honorific,
          password: hashedPassword,
          email: lowercaseEmail,
          classes: [],
        })
        user.password = undefined

        // Confirm teacher creation
        if (user) {
          res.status(201).json({
            user: user,
            token: generateToken(user._id),
          })
          return
        }
      }
    }

    // Student account creation
    else if (userType === 1) {
      if(!email && !parentEmail) {
        throw new Error('Must have either an email or parent email')
      }

      // Make sure username is not empty and valid
      verifyUsername(username)

      // Make sure username is not taken
      const usernameRegex = new RegExp(username, 'i')
      const userExists = await User.findOne({ username: { $regex: usernameRegex } })
      if (userExists) {
        throw new Error('Username is taken')
      }

      // Creating student with email
      let lowercaseEmail
      if(email) {
        verifyEmail(email)
        lowercaseEmail = email.toLowerCase()

        // Make sure email is not taken
        const emailInUse = await User.findOne({ email: lowercaseEmail })
        if (emailInUse) {
          throw new Error('Email already used')
        }
      }

      // Creating student with parent email
      let parent
      let parentId
      let lowercaseParentEmail
      if(parentEmail) {
        verifyEmail(parentEmail)

        lowercaseParentEmail = parentEmail.toLowerCase()
        // Make sure that the parent email is a registered parent
        parent = await User.findOne({ email: lowercaseParentEmail })
        if (!parent) {
          throw new Error('Parent email not found. Please tell your parent to register.')
        }
        if(parent.userType !== 2) {
          throw new Error('The user with that email is not a parent')
        }
        // Set the student's parent appropriately
        parentId = parent._id
      }

      const user = await User.create({
        userType,
        username,
        password: hashedPassword,
        firstName,
        lastName,

        email: lowercaseEmail,
        parentId,
        parentEmail: lowercaseParentEmail,
        classes: [],
        
        friends: [],
        receivedFriendRequests: [],
        sentFriendRequests: [],

        completed: [],
        slimeGel: 0,
        flowers: 0,
        slimes: [],
        roster: [null, null, null, null],
        items: [],
        lastRewards: [0, 0],
      })
      user.password = undefined

      if(parent) {
        parent.students.push(user._id)
        await User.findByIdAndUpdate(parent._id, {students: parent.students})
      }

      if (user) {
        res.status(201).json({
          user: user,
          token: generateToken(user._id),
        })
        return
      }
    }

    // If failed to create user
    throw new Error('Failed to create user')
  } catch (error) {
    res.status(400).json({message: error.message})
  }
}