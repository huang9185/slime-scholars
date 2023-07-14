
export const checkUserType = async(user, ...authorizedUserTypes) => {
  if(!authorizedUserTypes.includes(user.userType)) {
    throw new Error('Not authorized for your user type')
  }
}