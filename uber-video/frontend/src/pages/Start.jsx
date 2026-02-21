import React from 'react'
import { Link } from 'react-router-dom'

const Start = () => {
  return (
    <div>
      <div className='bg-cover bg-center bg-[url(https://images.unsplash.com/photo-1586773860418-d37222d8fce2?q=80&w=2573&auto=format&fit=crop)] h-screen pt-8 flex justify-between flex-col w-full'>
        <div className='flex items-center ml-8'>
          <i className="ri-hospital-line text-4xl text-white bg-primary p-2 rounded-full"></i>
          <span className='text-3xl font-bold text-white ml-2'>Ambulance</span>
        </div>
        <div className='bg-white pb-8 py-4 px-4'>
          <h2 className='text-[30px] font-semibold'>Rapid Emergency Response</h2>
          <Link to='/login' className='flex items-center justify-center w-full bg-primary text-white py-3 rounded-lg mt-5 font-bold text-lg'>Book an Ambulance</Link>
        </div>
      </div>
    </div>
  )
}

export default Start