import { mongoose } from 'mongoose'
import { authenticate } from "../../../utils/authenticate"
import connectDB from '../../../utils/connectDB'
import User from '../../../models/userModel'

/**
 * @desc    Delete received friend request
 * @route   POST /api/user/delete-received-request
 * @access  Private
 * @param   {string} req.body.friendId - Account id of person you want delete the request of
 */
export default async function (req, res) {
  try {
    if(req.method !== 'POST') {
      throw new Error(`${req.method} is an invalid request method`)
    }

    // Connect to database
    await connectDB()

    // Authenticate and get user
    const user = await authenticate(req.headers.authorization)

    const { friendId } = req.body

    const friendIdObj = mongoose.Types.ObjectId(friendId)

    if(!user.receivedFriendRequests.includes(friendIdObj)) {
      throw new Error('No friend request to delete')
    }

    const friend = await User.findById(friendIdObj)
    if(!friend) {
      throw new Error('User not found')
    }

    // Delete friend request
    user.receivedFriendRequests = user.friends.filter((element) => element == friendIdObj)
    friend.sentFriendRequests = friend.friends.filter((element) => element == user._id)

    // Update database
    await User.findByIdAndUpdate(user._id, {
      receivedFriendRequests: user.receivedFriendRequests,
    })
    await User.findByIdAndUpdate(friendIdObj, {
      sentFriendRequests: friend.sentFriendRequests,
    })

    res.status(200).json({receivedFriendRequests: user.receivedFriendRequests})

  } catch(error) {
    res.status(400).json({message: error.message})
  }
}
