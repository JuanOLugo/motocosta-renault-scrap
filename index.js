const { default: axios } = require("axios")
const { writeFileSync } = require("fs")
const { join } = require("path")
const ejs = require("ejs")
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const motocostaWebRenew = "https://motocostarenault.com/wp-json/wp/v2/usados?per_page=100"
const motocostaImageCarUrl = (id) => `https://motocostarenault.com/wp-json/wp/v2/media?parent=${id}`

const getMotocostaWebRenew = async (nombreDelvehiculo) => {

    if (!nombreDelvehiculo) {
        console.log("Debe ingresar un nombre de vehiculo")
        return
    }

    const response = await axios.get(motocostaWebRenew)
    const datacars = response.data
    const informationInject = {

    }

    console.log("----------------- CARROS INFORMACION GENERAL --------------------------------")
    const totalCars = datacars.length
    informationInject.totalCars = totalCars
    console.log("Total de carros usados en Motocosta: ", totalCars)


    const dusters = []

    try {
        for (const car of datacars) {
            if (car.title.rendered.toLowerCase().includes(nombreDelvehiculo)) {
                const imagesResponse = await axios.get(motocostaImageCarUrl(car.id))
                const images = imagesResponse.data
                const item = images.find(img => img.post === car.id)
                dusters.push({
                    title: car.title.rendered,
                    price: car.meta.precio,
                    link: car.link,
                    image: item.source_url,
                    id: car.id,
                    mime_type: item.mime_type,
                })
            }
        }
    } catch (error) {
        console.log(error)
    }



    console.log(`----------------- CARROS INFORMACION ${nombreDelvehiculo} --------------------------------`)
    for (const duster of dusters) {
        console.log(`Title: ${duster.title},  Link: ${duster.link}, Id: ${duster.id}`)
    }

    const totalDusters = dusters.length
    informationInject.totalDusters = totalDusters
    informationInject.dustersList = dusters
    console.log(`Total de carros ${nombreDelvehiculo} en Motocosta: `, totalDusters)

    // Verify new duster
    let dataJson = null
    try {
        dataJson = require(`./total_${nombreDelvehiculo}.json`)
    } catch (error) {
        dataJson = {}
    }
    const newDustersList = []
    for (const duster of dusters) {
        const dusterFound = dataJson?.dustersList?.find(d => d.id === duster.id)
        if (!dusterFound) {
            console.log(`Vehiculo nuevo ${nombreDelvehiculo} encontrado: `, duster.title)
            newDustersList.push(duster)

        }
    }

    informationInject.newDusterList = newDustersList




    console.log("----------------- CARROS INFORMACION LOGOUT --------------------------------")
    console.log("Total de carros usados en Motocosta: ", totalCars)
    console.log(`Total de carros ${nombreDelvehiculo} en Motocosta: `, totalDusters)
    console.log(`Total de carros ${nombreDelvehiculo} nuevos encontrados: `, newDustersList.length)

    if (newDustersList.length > 0) {
        console.log(`Enviando notificacion de ${nombreDelvehiculo}`)
        try {
            await enviarNotificacion(newDustersList, nombreDelvehiculo.toUpperCase());
        } catch (error) {
            console.log("error al enviar correo", error)
            return
        }
    }

    try {
        writeFileSync(join(__dirname, `total_${nombreDelvehiculo}.json`), JSON.stringify(informationInject))
    } catch (error) {
        console.log(error)
    }


}

const buildMailHtml = async (dustersList, nombreveh) => {

    const html = await ejs.renderFile(
        join(__dirname, "email.ejs"),
        {
            dusters: dustersList,
            nombreveh
        })
    return html
}




async function enviarNotificacion(dustersList, nombreveh) {
    // 1. Configurar el transportador (Servidor SMTP)
    const transporter = nodemailer.createTransport({
        host: '64.233.176.109',          // IP de smtp.gmail.com (IPv4)
        port: 465,
        secure: true,
        auth: {
            user: "correo@gmail.com",
            pass: "wow"
        },
        tls: {
            servername: 'smtp.gmail.com', // muy importante
            rejectUnauthorized: false
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 20000
    });



    // 2. Definir las opciones del correo electrónico
    const mailOptions = {
        from: 'Motocosta Scraper <correo@gmail.com>',
        to: ['correo@gmail.com'],
        subject: '¡Nuevo vehiculo agregado en motocosta! 🚨',
        html: await buildMailHtml(dustersList, nombreveh)
    };

    // 3. Enviar el correo electrónico
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado con éxito: %s', info.messageId);
    } catch (error) {
        console.error('Error al enviar el correo:', error);
    }
}



console.log("Iniciando el scraper de Motocosta...")
cron.schedule('*/1 * * * *', async () => {
    const vehiculos = ["duster", "logan", "stepway", "sandero"]


    for (const vehiculo of vehiculos) {
        try {
            await getMotocostaWebRenew(vehiculo)
        } catch (error) {
            console.log(`Error al obtener informacion de ${vehiculo}`, error)
        }
    }
});